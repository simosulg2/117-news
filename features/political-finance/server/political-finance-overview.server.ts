import { InProcessSnapshotCache } from "../../../lib/snapshot-cache.ts";
import type {
  PoliticalFinancePeriod,
  PoliticalFinanceResponse,
  PoliticalFinanceSource,
} from "../../../lib/political-finance-types";
import {
  aggregateCoverageKey,
  buildPoliticalFinanceSummaries,
  periodSort,
  type ErjkAggregateCoverage,
  type ErjkDetailBundle,
} from "../model/political-finance-model.ts";
import { fetchErjkJson } from "./erjk-client.server.ts";
import {
  ERJK_API_DOCUMENTATION_URL,
  ERJK_LICENCE_URL,
  ERJK_OPEN_DATA_URL,
} from "./erjk-config.ts";
import {
  parseErjkAggregateRows,
  parseErjkReceiptRows,
  parseErjkReportReferences,
  type ErjkAggregateRow,
} from "./erjk-parser.ts";

const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1_000;
const STALE_RETRY_DELAY_MS = 15 * 60 * 1_000;
const overviewCache = new InProcessSnapshotCache<PoliticalFinanceResponse>(
  SNAPSHOT_TTL_MS,
  STALE_RETRY_DELAY_MS,
);

type AggregateTask = {
  kind: "income" | "expense";
  period: PoliticalFinancePeriod;
  path: string;
};

export function collectAggregateResults(
  tasks: readonly AggregateTask[],
  results: readonly PromiseSettledResult<ErjkAggregateRow[]>[],
): { rows: ErjkAggregateRow[]; coverage: ErjkAggregateCoverage; failures: number } {
  if (tasks.length !== results.length) throw new Error("ERJK aggregate task/result count mismatch");
  return {
    rows: results.flatMap((result) => result.status === "fulfilled" ? result.value : []),
    coverage: new Set(results.flatMap((result, index) => result.status === "fulfilled"
      ? [aggregateCoverageKey(tasks[index].period, tasks[index].kind)]
      : [])),
    failures: results.filter((result) => result.status === "rejected").length,
  };
}

async function mapConcurrent<T, R>(values: readonly T[], limit: number, work: (value: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await work(values[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function aggregateTasks(now: Date): AggregateTask[] {
  let year = now.getUTCFullYear();
  let quarter = Math.ceil((now.getUTCMonth() + 1) / 3) - 1;
  if (quarter === 0) {
    year -= 1;
    quarter = 4;
  }
  const periods: Array<{ year: number; quarter: 1 | 2 | 3 | 4 }> = [];
  for (let index = 0; index < 8; index += 1) {
    periods.push({ year, quarter: quarter as 1 | 2 | 3 | 4 });
    quarter -= 1;
    if (quarter === 0) {
      year -= 1;
      quarter = 4;
    }
  }
  return periods.flatMap(({ year, quarter }) => {
    const period = `${year}-Q${quarter}` as PoliticalFinancePeriod;
    return [
      {
        kind: "income" as const,
        period,
        path: `/quarterly-reports/queries/receipts?party_id=all&category_id=all&period=${year}&quarter=q${quarter}`,
      },
      {
        kind: "expense" as const,
        period,
        path: `/quarterly-reports/queries/expenses?party_id=all&category_id=all_sum&period=${year}&quarter=q${quarter}`,
      },
    ];
  });
}

async function loadDetails(
  partyRows: readonly ErjkAggregateRow[],
  latestPeriod: PoliticalFinancePeriod,
): Promise<{ details: ErjkDetailBundle[]; failures: number }> {
  const parties = [...new Map(
    partyRows
      .filter((row) => row.period === latestPeriod)
      .map((row) => [row.sourcePartyId, row]),
  ).values()];
  const results = await mapConcurrent(parties, 8, async (party): Promise<ErjkDetailBundle> => {
    const reportList = parseErjkReportReferences(
      await fetchErjkJson(`/quarterly-reports/quarters/${encodeURIComponent(party.sourcePartyId)}`),
    );
    const report = reportList.find((item) => item.period === latestPeriod);
    if (!report) throw new Error("ERJK filing reference was not found");
    const receipts = parseErjkReceiptRows(
      await fetchErjkJson(`/quarterly-reports/${report.reportId}?report_type=receipts`),
    );
    return {
      sourcePartyId: party.sourcePartyId,
      period: latestPeriod,
      reportId: report.reportId,
      receipts,
    };
  });
  return {
    details: results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
    failures: results.filter((result) => result.status === "rejected").length,
  };
}

function source(retrievedAt: string, status: PoliticalFinanceSource["status"], failures: number): PoliticalFinanceSource {
  return {
    id: "erjk",
    name: "Erakondade Rahastamise Järelevalve Komisjon",
    pageUrl: ERJK_OPEN_DATA_URL,
    apiDocumentationUrl: ERJK_API_DOCUMENTATION_URL,
    licence: "CC BY-SA 3.0",
    licenceUrl: ERJK_LICENCE_URL,
    status,
    statusMessage: status === "partial"
      ? `${failures} ametliku allika andmeosa ei olnud täielikult kasutatav.`
      : status === "stale" ? "ERJK värskendus ebaõnnestus; näidatakse viimast edukat tõmmist." : null,
    retrievedAt,
    publishedAt: null,
  };
}

export async function refreshPoliticalFinanceOverview(now = new Date()): Promise<PoliticalFinanceResponse> {
  const tasks = aggregateTasks(now);
  const results = await mapConcurrent(tasks, 8, async (task) =>
    parseErjkAggregateRows(await fetchErjkJson(task.path), task.kind, task.period));
  const { rows, coverage, failures: aggregateFailures } = collectAggregateResults(tasks, results);
  if (rows.length === 0) throw new Error("ERJK did not return any usable quarterly reports");

  const availablePeriods = [...new Set(rows.map((row) => row.period))].sort(periodSort).reverse();
  const latestPeriod = availablePeriods[0];
  const detailResult = await loadDetails(rows, latestPeriod);
  const parties = buildPoliticalFinanceSummaries(rows, detailResult.details, latestPeriod, coverage);
  const reconciliationFailures = parties.filter((party) => party.detailReconciles === false).length;
  const failures = aggregateFailures + detailResult.failures + reconciliationFailures;
  const retrievedAt = new Date().toISOString();
  return {
    period: latestPeriod,
    availablePeriods,
    parties,
    source: source(retrievedAt, failures > 0 ? "partial" : "ok", failures),
    retrievedAt,
  };
}

export async function getPoliticalFinanceOverview(): Promise<PoliticalFinanceResponse> {
  const snapshot = await overviewCache.get(() => refreshPoliticalFinanceOverview());
  if (snapshot.status !== "stale-if-error") return snapshot.value;
  return {
    ...snapshot.value,
    source: source(snapshot.value.retrievedAt, "stale", 0),
  };
}
