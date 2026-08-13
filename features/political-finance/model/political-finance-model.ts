import type {
  PoliticalFinanceDonation,
  PoliticalFinanceDonor,
  PoliticalFinancePartySummary,
  PoliticalFinancePeriod,
  PoliticalFinanceRecord,
  PoliticalFinanceRecordType,
} from "../../../lib/political-finance-types";
import { ERJK_API_ORIGIN, erjkPartyPresentation } from "../server/erjk-config.ts";
import type { ErjkAggregateRow, ErjkExpenseRow, ErjkReceiptRow } from "../server/erjk-parser";

export type ErjkDetailBundle = {
  sourcePartyId: string;
  period: PoliticalFinancePeriod;
  reportId: number;
  receipts: ErjkReceiptRow[];
};

export type ErjkAggregateCoverage = ReadonlySet<
  `${PoliticalFinancePeriod}:${"income" | "expense"}`
>;

const DONATION_CATEGORIES = new Set(["Rahaline annetus", "Mitterahaline annetus"]);

export function periodSort(left: PoliticalFinancePeriod, right: PoliticalFinancePeriod): number {
  return left.localeCompare(right);
}

export function aggregateCoverageKey(
  period: PoliticalFinancePeriod,
  kind: "income" | "expense",
): `${PoliticalFinancePeriod}:${"income" | "expense"}` {
  return `${period}:${kind}`;
}

export function categoryId(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("et-EE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "muu";
}

function hash(input: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value = Math.imul(value ^ input.charCodeAt(index), 0x01000193);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

export function recordsRevisionId(filingId: string, records: readonly PoliticalFinanceRecord[]): string {
  const material = records
    .map((record) => `${record.id}|${record.categoryId}|${record.date}|${record.amount}`)
    .sort()
    .join(";");
  return `${filingId}:${hash(material)}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum(values: readonly number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1_000) / 10;
}

function sortedReceiptRows(rows: readonly ErjkReceiptRow[]): ErjkReceiptRow[] {
  return [...rows].sort((left, right) =>
    `${right.date ?? ""}|${right.categoryName}|${right.reportedName}|${right.amount}|${right.counterpartyKey}`.localeCompare(
      `${left.date ?? ""}|${left.categoryName}|${left.reportedName}|${left.amount}|${left.counterpartyKey}`,
      "et",
    ));
}

function donationViews(rows: readonly ErjkReceiptRow[], partyScope: string): {
  concentration: number | null;
  largestDonations: PoliticalFinanceDonation[];
  largestDonors: PoliticalFinanceDonor[];
  roundingTolerance: number;
  total: number;
} {
  const donations = sortedReceiptRows(rows.filter((row) => DONATION_CATEGORIES.has(row.categoryName)));
  const keyed = new Map<string, { name: string; amount: number; count: number }>();
  for (const row of donations) {
    const current = keyed.get(row.counterpartyKey) ?? { name: row.reportedName, amount: 0, count: 0 };
    current.amount = roundMoney(current.amount + row.amount);
    current.count += 1;
    keyed.set(row.counterpartyKey, current);
  }
  const donors = [...keyed.entries()]
    .map(([privateKey, donor]) => ({ privateKey, donorName: donor.name, amount: donor.amount, donationCount: donor.count }))
    .sort((left, right) => right.amount - left.amount || left.donorName.localeCompare(right.donorName, "et") || left.privateKey.localeCompare(right.privateKey));
  const publicNameTotals = new Map<string, number>();
  for (const donor of donors) publicNameTotals.set(donor.donorName, (publicNameTotals.get(donor.donorName) ?? 0) + 1);
  const publicNameOccurrences = new Map<string, number>();
  const publicDonors = donors.map(({ privateKey: _privateKey, ...donor }) => {
    const occurrence = (publicNameOccurrences.get(donor.donorName) ?? 0) + 1;
    publicNameOccurrences.set(donor.donorName, occurrence);
    const ambiguousIdentity = publicNameTotals.get(donor.donorName) !== 1;
    const publicIdentity = !ambiguousIdentity
      ? `${partyScope}|${donor.donorName}`
      : `${partyScope}|ambiguous|${donor.donorName}|${donor.amount}|${donor.donationCount}|${occurrence}`;
    return { id: `donor-${hash(publicIdentity)}`, ambiguousIdentity, ...donor };
  });
  const total = sum(donations.map((row) => row.amount));
  const signatures = new Map<string, number>();
  const largestDonations = [...donations]
    .sort((left, right) => right.amount - left.amount || (right.date ?? "").localeCompare(left.date ?? ""))
    .slice(0, 8)
    .map((row) => {
      const signature = `${row.date}|${row.categoryName}|${row.reportedName}|${row.amount}`;
      const occurrence = (signatures.get(signature) ?? 0) + 1;
      signatures.set(signature, occurrence);
      return {
        id: `donation-${hash(`${signature}|${occurrence}`)}`,
        donorName: row.reportedName,
        amount: row.amount,
        date: row.date,
        category: row.categoryName,
      };
    });
  return {
    concentration: total > 0 && donations.every((row) => row.amount >= 0)
      ? pct(sum(publicDonors.slice(0, 5).map((donor) => donor.amount)), total)
      : null,
    largestDonations,
    largestDonors: publicDonors.slice(0, 8),
    roundingTolerance: donations.length * 0.5 + 0.01,
    total,
  };
}

export function buildPoliticalFinanceSummaries(
  rows: readonly ErjkAggregateRow[],
  details: readonly ErjkDetailBundle[],
  latestPeriod: PoliticalFinancePeriod,
  coverage: ErjkAggregateCoverage,
): PoliticalFinancePartySummary[] {
  const periods = [...new Set(rows.map((row) => row.period))].sort(periodSort).slice(-8);
  const latestPartyIds = [...new Set(rows.filter((row) => row.period === latestPeriod).map((row) => row.sourcePartyId))];

  return latestPartyIds.map((sourcePartyId) => {
    const partyRows = rows.filter((row) => row.sourcePartyId === sourcePartyId);
    const sourceName = partyRows.find((row) => row.sourcePartyName)?.sourcePartyName ?? sourcePartyId;
    const presentation = erjkPartyPresentation(sourcePartyId, sourceName);
    const current = partyRows.filter((row) => row.period === latestPeriod);
    const incomeRows = current.filter((row) => row.kind === "income");
    const hasIncome = coverage.has(aggregateCoverageKey(latestPeriod, "income"));
    const hasExpenses = coverage.has(aggregateCoverageKey(latestPeriod, "expense"));
    const income = hasIncome ? sum(incomeRows.map((row) => row.amount)) : null;
    const expenses = hasExpenses
      ? sum(current.filter((row) => row.kind === "expense").map((row) => row.amount))
      : null;
    const donations = hasIncome
      ? sum(incomeRows.filter((row) => DONATION_CATEGORIES.has(row.categoryName)).map((row) => row.amount))
      : null;
    const detail = details.find((entry) => entry.sourcePartyId === sourcePartyId && entry.period === latestPeriod);
    const donationDetail = detail ? donationViews(detail.receipts, sourcePartyId) : null;
    const sourceReportId = detail?.reportId ?? null;
    const filingId = `erjk:${sourcePartyId}:${latestPeriod}`;
    const revisionMaterial = [
      sourceReportId ?? "none",
      ...current.map((row) => `${row.kind}|${row.categoryId}|${row.amount}`).sort(),
      ...(detail?.receipts ?? []).map((row) => `${row.date}|${row.categoryName}|${row.reportedName}|${row.amount}`).sort(),
    ].join(";");
    return {
      ...presentation,
      sourcePartyId,
      sourceName,
      filing: {
        id: filingId,
        revisionId: `${filingId}:${hash(revisionMaterial)}`,
        period: latestPeriod,
        sourceReportId,
        sourceUrl: sourceReportId
          ? `${ERJK_API_ORIGIN}/quarterly-reports/${sourceReportId}?report_type=receipts`
          : `${ERJK_API_ORIGIN}/quarterly-reports/quarters/${sourcePartyId}`,
      },
      income,
      expenses,
      donations,
      donationSharePct: donations !== null && income !== null ? pct(donations, income) : null,
      donorConcentrationTop5Pct: donationDetail?.concentration ?? null,
      detailReconciles: donationDetail
        && donations !== null
        ? Math.abs(donationDetail.total - donations) <= donationDetail.roundingTolerance
        : null,
      incomeCategories: hasIncome ? incomeRows
        .map((row) => ({ id: row.categoryId, name: row.categoryName, amount: row.amount, sharePct: pct(row.amount, income ?? 0) }))
        .sort((left, right) => right.amount - left.amount) : [],
      largestDonations: donationDetail?.largestDonations ?? [],
      largestDonors: donationDetail?.largestDonors ?? [],
      history: periods.map((period) => {
        const periodRows = partyRows.filter((row) => row.period === period);
        const periodHasIncome = coverage.has(aggregateCoverageKey(period, "income"));
        const periodHasExpenses = coverage.has(aggregateCoverageKey(period, "expense"));
        return {
          period,
          income: periodHasIncome
            ? sum(periodRows.filter((row) => row.kind === "income").map((row) => row.amount))
            : null,
          expenses: periodHasExpenses
            ? sum(periodRows.filter((row) => row.kind === "expense").map((row) => row.amount))
            : null,
          donations: periodHasIncome
            ? sum(periodRows.filter((row) => row.kind === "income" && DONATION_CATEGORIES.has(row.categoryName)).map((row) => row.amount))
            : null,
        };
      }),
    };
  }).sort((left, right) => {
    if (left.income === null) return right.income === null ? left.name.localeCompare(right.name, "et") : 1;
    if (right.income === null) return -1;
    return right.income - left.income || left.name.localeCompare(right.name, "et");
  });
}

export function buildPoliticalFinanceRecords(args: {
  partyId: string;
  sourcePartyId: string;
  period: PoliticalFinancePeriod;
  reportId: number;
  recordType: PoliticalFinanceRecordType;
  receipts?: readonly ErjkReceiptRow[];
  expenses?: readonly ErjkExpenseRow[];
}): PoliticalFinanceRecord[] {
  const sourceUrl = `${ERJK_API_ORIGIN}/quarterly-reports/${args.reportId}?report_type=${args.recordType === "expenses" ? "expenses" : "receipts"}`;
  const candidates = args.recordType === "expenses"
    ? (args.expenses ?? []).map((row) => ({ categoryName: row.categoryName, reportedName: null, date: null, amount: row.amount, type: "expense" as const }))
    : sortedReceiptRows(args.receipts ?? [])
      .filter((row) => args.recordType === "income" || DONATION_CATEGORIES.has(row.categoryName))
      .map((row) => ({ categoryName: row.categoryName, reportedName: row.reportedName, date: row.date, amount: row.amount, type: DONATION_CATEGORIES.has(row.categoryName) ? "donation" as const : "income" as const }));
  const occurrences = new Map<string, number>();
  const filingId = `erjk:${args.sourcePartyId}:${args.period}`;
  return candidates.map((row) => {
    const signature = `${row.date}|${row.categoryName}|${row.reportedName}|${row.amount}`;
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    return {
      id: `erjk-record-${hash(`${filingId}|${signature}|${occurrence}`)}`,
      filingId,
      partyId: args.partyId,
      sourcePartyId: args.sourcePartyId,
      period: args.period,
      type: row.type,
      categoryId: categoryId(row.categoryName),
      categoryName: row.categoryName,
      reportedName: row.reportedName,
      date: row.date,
      amount: row.amount,
      sourceReportId: args.reportId,
      sourceUrl,
    };
  });
}
