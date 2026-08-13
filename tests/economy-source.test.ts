import assert from "node:assert/strict";
import test from "node:test";

import type { EconomyTableDefinition } from "../features/economy/server/economy-series.ts";
import {
  fetchStatisticsEstoniaTable,
  StatisticsEstoniaError,
} from "../features/economy/server/statistics-estonia.server.ts";

function definition(suffix: string): EconomyTableDefinition {
  return {
    groupId: "prices",
    tableId: suffix,
    title: "TEST TABLE",
    apiUrl: `https://andmed.stat.ee/api/v1/et/stat/${suffix}`,
    tableUrl: `https://andmed.stat.ee/et/stat/${suffix}`,
    catalogUrl: `https://andmed.stat.ee/api/v1/et/stat/catalog-${suffix}`,
    dimensions: ["Period", "Indicator"],
    requiredLabels: { Indicator: { VALUE: "Value, eurot" } },
    query: [
      { code: "Period", selection: { filter: "top", values: ["2"] } },
      { code: "Indicator", selection: { filter: "item", values: ["VALUE"] } },
    ],
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function validDataset(tableId: string) {
  return {
    class: "dataset",
    label: "TEST TABLE",
    source: "Statistikaamet",
    id: ["Period", "Indicator"],
    size: [2, 1],
    dimension: {
      Period: { category: { index: { "2025Q1": 0, "2026Q1": 1 }, label: { "2025Q1": "2025 I", "2026Q1": "2026 I" } } },
      Indicator: { category: { index: { VALUE: 0 }, label: { VALUE: "Value, eurot" } } },
    },
    value: [100, 110],
    extension: { px: { tableid: tableId } },
  };
}

test("adapter sends a bounded JSON-stat2 query and preserves official freshness metadata", async () => {
  const table = definition("TEST-SUCCESS");
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init: init ?? {} });
    if (url === table.apiUrl) return jsonResponse(validDataset(table.tableId));
    return jsonResponse([{ id: `${table.tableId}.PX`, type: "t", updated: "2026-08-13T10:30:00" }]);
  };
  const result = await fetchStatisticsEstoniaTable(table, fetchMock as typeof fetch);
  assert.equal(requests.length, 2);
  const dataRequest = requests.find((request) => request.url === table.apiUrl)!;
  assert.equal(dataRequest.init.method, "POST");
  assert.equal(dataRequest.init.redirect, "error");
  assert.match(String((dataRequest.init.headers as Record<string, string>)["Content-Type"]), /charset=utf-8/);
  assert.deepEqual(JSON.parse(String(dataRequest.init.body)).response, { format: "json-stat2" });
  assert.equal(result.source.updatedAt, "2026-08-13T07:30:00.000Z");
  assert.equal(result.source.licenceName, "CC BY-SA 4.0");
  assert.equal(result.dataset.cell({ Period: "2026Q1", Indicator: "VALUE" }).value, 110);
});

test("adapter rejects schema drift before values reach the public contract", async () => {
  const table = definition("TEST-DRIFT");
  const fetchMock = async (input: URL | RequestInfo) => String(input) === table.apiUrl
    ? jsonResponse({ ...validDataset(table.tableId), source: "Unknown provider" })
    : jsonResponse([]);
  await assert.rejects(
    fetchStatisticsEstoniaTable(table, fetchMock as typeof fetch),
    (error: unknown) => error instanceof StatisticsEstoniaError && error.code === "schema",
  );
});

test("Retry-After prevents repeated upstream calls while a rate limit is active", async () => {
  const table = definition("TEST-RATE-LIMIT");
  let dataRequests = 0;
  const fetchMock = async (input: URL | RequestInfo) => {
    if (String(input) === table.apiUrl) {
      dataRequests += 1;
      return jsonResponse({ error: "too many" }, 429, { "Retry-After": "60" });
    }
    return jsonResponse([]);
  };
  await assert.rejects(fetchStatisticsEstoniaTable(table, fetchMock as typeof fetch));
  await assert.rejects(
    fetchStatisticsEstoniaTable(table, fetchMock as typeof fetch),
    (error: unknown) => error instanceof StatisticsEstoniaError && error.code === "rate-limited",
  );
  assert.equal(dataRequests, 1);
});

test("non-JSON responses are rejected without parsing upstream text", async () => {
  const table = definition("TEST-CONTENT-TYPE");
  const fetchMock = async (input: URL | RequestInfo) => String(input) === table.apiUrl
    ? new Response("<html>bad gateway</html>", { headers: { "Content-Type": "text/html" } })
    : jsonResponse([]);
  await assert.rejects(
    fetchStatisticsEstoniaTable(table, fetchMock as typeof fetch),
    (error: unknown) => error instanceof StatisticsEstoniaError && error.code === "content-type",
  );
});
