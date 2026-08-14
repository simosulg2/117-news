import { partyIdentity } from "../../../lib/party-registry.ts";
import { InProcessSnapshotCache } from "../../../lib/snapshot-cache.ts";
import type {
  PoliticalFinancePeriod,
  PoliticalFinanceRecord,
  PoliticalFinanceRecordsResponse,
  PoliticalFinanceRecordType,
  PoliticalFinanceSource,
} from "../../../lib/political-finance-types";
import { recordsRevisionId } from "../model/political-finance-model.ts";
import { buildPoliticalFinanceRecords } from "../model/political-finance-records.ts";
import { fetchErjkJson } from "./erjk-client.server.ts";
import {
  ERJK_API_DOCUMENTATION_URL,
  ERJK_API_ORIGIN,
  ERJK_LICENCE_URL,
  ERJK_OPEN_DATA_URL,
  erjkSourcePartyId,
  erjkSourcePartyName,
} from "./erjk-config.ts";
import { parseErjkExpenseRows, parseErjkReceiptRows, parseErjkReportReferences } from "./erjk-parser.ts";

const DETAIL_TTL_MS = 6 * 60 * 60 * 1_000;
const DETAIL_RETRY_MS = 15 * 60 * 1_000;
const MAX_DETAIL_CACHES = 64;
const detailCaches = new Map<string, InProcessSnapshotCache<LoadedDetail>>();

type LoadedDetail = {
  reportId: number;
  records: PoliticalFinanceRecord[];
  retrievedAt: string;
};

export class PoliticalFinanceRecordsQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PoliticalFinanceRecordsQueryError";
  }
}

export class PoliticalFinanceRecordsNotFoundError extends Error {
  constructor() {
    super("Political finance filing was not found");
    this.name = "PoliticalFinanceRecordsNotFoundError";
  }
}

export type PoliticalFinanceRecordsQuery = {
  partyId: string;
  period: PoliticalFinancePeriod;
  recordType: PoliticalFinanceRecordType;
  category: string | null;
  page: number;
  pageSize: number;
};

function detailCache(key: string): InProcessSnapshotCache<LoadedDetail> {
  const existing = detailCaches.get(key);
  if (existing) return existing;
  if (detailCaches.size >= MAX_DETAIL_CACHES) {
    const oldest = detailCaches.keys().next().value as string | undefined;
    if (oldest) detailCaches.delete(oldest);
  }
  const cache = new InProcessSnapshotCache<LoadedDetail>(DETAIL_TTL_MS, DETAIL_RETRY_MS);
  detailCaches.set(key, cache);
  return cache;
}

function recordSource(retrievedAt: string, stale: boolean): PoliticalFinanceSource {
  return {
    id: "erjk",
    name: "Erakondade Rahastamise Järelevalve Komisjon",
    pageUrl: ERJK_OPEN_DATA_URL,
    apiDocumentationUrl: ERJK_API_DOCUMENTATION_URL,
    licence: "CC BY-SA 3.0",
    licenceUrl: ERJK_LICENCE_URL,
    status: stale ? "stale" : "ok",
    statusMessage: stale ? "ERJK värskendus ebaõnnestus; näidatakse viimast edukat tõmmist." : null,
    retrievedAt,
    publishedAt: null,
  };
}

async function loadDetail(query: PoliticalFinanceRecordsQuery, sourcePartyId: string): Promise<LoadedDetail> {
  const reports = parseErjkReportReferences(
    await fetchErjkJson(`/quarterly-reports/quarters/${encodeURIComponent(sourcePartyId)}`),
  );
  const report = reports.find((item) => item.period === query.period);
  if (!report) throw new PoliticalFinanceRecordsNotFoundError();
  const reportType = query.recordType === "expenses" ? "expenses" : "receipts";
  const input = await fetchErjkJson(`/quarterly-reports/${report.reportId}?report_type=${reportType}`);
  const sourceUrl = `${ERJK_API_ORIGIN}/quarterly-reports/${report.reportId}?report_type=${reportType}`;
  const records = buildPoliticalFinanceRecords({
    partyId: query.partyId,
    sourcePartyId,
    period: query.period,
    reportId: report.reportId,
    recordType: query.recordType,
    sourceUrl,
    receipts: reportType === "receipts" ? parseErjkReceiptRows(input) : undefined,
    expenses: reportType === "expenses" ? parseErjkExpenseRows(input) : undefined,
  });
  return { reportId: report.reportId, records, retrievedAt: new Date().toISOString() };
}

export async function getPoliticalFinanceRecords(
  query: PoliticalFinanceRecordsQuery,
): Promise<PoliticalFinanceRecordsResponse> {
  const identity = partyIdentity(query.partyId);
  const sourcePartyId = erjkSourcePartyId(query.partyId);
  if (!identity || !sourcePartyId) throw new PoliticalFinanceRecordsQueryError("Unknown party");
  const cacheKey = `${sourcePartyId}:${query.period}:${query.recordType}`;
  const snapshot = await detailCache(cacheKey).get(() => loadDetail(query, sourcePartyId));
  const categoryRecords = query.category
    ? snapshot.value.records.filter((record) => record.categoryId === query.category)
    : snapshot.value.records;
  const categoryMap = new Map<string, { id: string; name: string; count: number }>();
  for (const record of snapshot.value.records) {
    const current = categoryMap.get(record.categoryId) ?? {
      id: record.categoryId,
      name: record.categoryName,
      count: 0,
    };
    current.count += 1;
    categoryMap.set(record.categoryId, current);
  }
  const total = categoryRecords.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const filingId = `erjk:${sourcePartyId}:${query.period}`;
  return {
    party: {
      id: identity.id,
      sourcePartyId,
      name: identity.name,
      sourceName: erjkSourcePartyName(identity.id) ?? identity.name,
    },
    filing: {
      id: filingId,
      revisionId: recordsRevisionId(filingId, snapshot.value.records),
      period: query.period,
      sourceReportId: snapshot.value.reportId,
      sourceUrl: `${ERJK_API_ORIGIN}/quarterly-reports/${snapshot.value.reportId}?report_type=${query.recordType === "expenses" ? "expenses" : "receipts"}`,
    },
    recordType: query.recordType,
    category: query.category,
    page,
    pageSize: query.pageSize,
    total,
    totalPages,
    availableCategories: [...categoryMap.values()].sort((left, right) =>
      right.count - left.count || left.name.localeCompare(right.name, "et")),
    records: categoryRecords.slice(start, start + query.pageSize),
    source: recordSource(snapshot.value.retrievedAt, snapshot.status === "stale-if-error"),
  };
}
