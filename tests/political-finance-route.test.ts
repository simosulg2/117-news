import assert from "node:assert/strict";
import test from "node:test";

import { handlePoliticalFinanceRecordsGet } from "../features/political-finance/server/political-finance-route.server.ts";

test("records route rejects unbounded and malformed filters before upstream work", async () => {
  const malformed = await handlePoliticalFinanceRecordsGet(new Request(
    "https://117.ee/api/political-finance/records?party=../x&period=forever&type=raw&pageSize=5000",
  ));
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers.get("cache-control"), "no-store");
  assert.deepEqual(await malformed.json(), { error: "Vigased rahastamisandmete päringuparameetrid." });
});

test("records route accepts only capped page sizes and known record modes", async () => {
  for (const url of [
    "https://117.ee/api/political-finance/records?party=reform&period=2026-Q2&type=donations&page=0",
    "https://117.ee/api/political-finance/records?party=reform&period=2026-Q2&type=income&pageSize=51",
    "https://117.ee/api/political-finance/records?party=reform&period=2026-Q2&type=expenses&category=BAD_VALUE",
  ]) {
    const response = await handlePoliticalFinanceRecordsGet(new Request(url));
    assert.equal(response.status, 400);
  }
});

test("records route rejects an unknown canonical party without upstream work", async () => {
  const response = await handlePoliticalFinanceRecordsGet(new Request(
    "https://117.ee/api/political-finance/records?party=not-a-party&period=2026-Q2&type=donations",
  ));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Tundmatu erakond." });
});
