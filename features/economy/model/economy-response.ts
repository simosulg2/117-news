import { summarizeEconomy } from "./economy-indicators.ts";
import {
  ECONOMY_GROUP_IDS,
  type EconomyGroup,
  type EconomyGroupId,
  type EconomyOverallStatus,
  type EconomyResponse,
} from "../../../lib/economy-types.ts";

export type FailedEconomyGroupFactory = (
  id: EconomyGroupId,
  reason: unknown,
  generatedAt: string,
) => EconomyGroup;

function overallStatus(groups: EconomyGroup[]): EconomyOverallStatus {
  const available = groups.filter((group) => group.status !== "failed").length;
  if (available === 0) return "failed";
  return groups.every((group) => group.status === "ok") ? "ok" : "partial";
}

export function composeEconomyResponse(
  results: readonly PromiseSettledResult<EconomyGroup>[],
  makeFailedGroup: FailedEconomyGroupFactory,
  generatedAt = new Date().toISOString(),
): EconomyResponse {
  if (results.length !== ECONOMY_GROUP_IDS.length) throw new RangeError("Economy group result count changed");
  const groups = results.map((result, index) => result.status === "fulfilled"
    ? result.value
    : makeFailedGroup(ECONOMY_GROUP_IDS[index], result.reason, generatedAt));
  const status = overallStatus(groups);
  const successful = groups.filter((group) => group.status !== "failed");
  const retrievedTimes = successful
    .map((group) => group.source.retrievedAt)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort();
  return {
    version: 1,
    generatedAt,
    status,
    summary: summarizeEconomy(groups),
    groups,
    sources: [{
      id: "statistics-estonia",
      name: "Statistikaamet",
      status,
      successfulGroups: successful.length,
      totalGroups: groups.length,
      oldestRetrievedAt: retrievedTimes[0] ?? null,
    }],
  };
}
