import assert from "node:assert/strict";
import test from "node:test";

import { composeEconomyResponse } from "../features/economy/model/economy-response.ts";
import { ECONOMY_GROUP_IDS, type EconomyGroup, type EconomyGroupId, type EconomySourceReference } from "../lib/economy-types.ts";

function source(id: string): EconomySourceReference {
  return {
    providerId: "statistics-estonia", providerName: "Statistikaamet", tableId: id,
    tableTitle: id, tableUrl: `https://andmed.stat.ee/et/stat/${id}`,
    apiUrl: `https://andmed.stat.ee/api/v1/et/stat/${id}`, updatedAt: null,
    retrievedAt: "2026-08-13T12:00:00.000Z", attribution: "Statistikaamet",
    licenceName: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    revisionPolicy: "latest-source-value",
  };
}

function group(id: EconomyGroupId): EconomyGroup {
  return { id, label: id, description: id, status: "ok", indicators: [], source: source(id), message: null };
}

function failedGroup(id: EconomyGroupId, _reason: unknown, generatedAt: string): EconomyGroup {
  return { id, label: id, description: id, status: "failed", indicators: [], source: { ...source(id), retrievedAt: generatedAt }, message: "failed" };
}

test("a failed provider group yields partial data without erasing successful groups", () => {
  const results: PromiseSettledResult<EconomyGroup>[] = ECONOMY_GROUP_IDS.map((id, index) => index === 2
    ? { status: "rejected", reason: new Error("down") }
    : { status: "fulfilled", value: group(id) });
  const response = composeEconomyResponse(results, failedGroup, "2026-08-13T12:00:00.000Z");
  assert.equal(response.status, "partial");
  assert.equal(response.groups.length, 6);
  assert.equal(response.groups[2].id, "work");
  assert.equal(response.groups[2].status, "failed");
  assert.equal(response.groups[0].status, "ok");
  assert.equal(response.sources[0].successfulGroups, 5);
});

test("all failed groups yield a failed but structurally complete response", () => {
  const results: PromiseSettledResult<EconomyGroup>[] = ECONOMY_GROUP_IDS.map(() => ({ status: "rejected", reason: new Error("down") }));
  const response = composeEconomyResponse(results, failedGroup, "2026-08-13T12:00:00.000Z");
  assert.equal(response.status, "failed");
  assert.equal(response.sources[0].successfulGroups, 0);
  assert.equal(response.summary.considered, 0);
});

test("result count mismatch is rejected before groups can be mislabelled", () => {
  assert.throws(() => composeEconomyResponse([], failedGroup, "2026-08-13T12:00:00.000Z"), /result count/);
});
