import type {
  PoliticalFinanceDonation,
  PoliticalFinanceDonor,
  PoliticalFinancePartySummary,
  PoliticalFinancePeriod,
} from "../../../lib/political-finance-types";
import {
  aggregateCoverageKey,
  DONATION_CATEGORIES,
  percentage,
  periodSort,
  politicalFinanceHash,
  sortedReceiptRows,
  sumMoney,
  type PoliticalFinanceAggregateCoverage,
  type PoliticalFinanceAggregateRow,
  type PoliticalFinanceDetailBundle,
  type PoliticalFinanceReceiptRow,
  type PoliticalFinanceSourceAdapter,
} from "./political-finance-model.ts";

function donationViews(rows: readonly PoliticalFinanceReceiptRow[], partyScope: string): {
  concentration: number | null;
  largestDonations: PoliticalFinanceDonation[];
  largestDonors: PoliticalFinanceDonor[];
  roundingTolerance: number;
  total: number;
} {
  const donations = sortedReceiptRows(
    rows.filter((row) => DONATION_CATEGORIES.has(row.categoryName)),
  );
  const keyed = new Map<string, { name: string; amount: number; count: number }>();
  for (const row of donations) {
    const current = keyed.get(row.counterpartyKey) ?? {
      name: row.reportedName,
      amount: 0,
      count: 0,
    };
    current.amount = sumMoney([current.amount, row.amount]);
    current.count += 1;
    keyed.set(row.counterpartyKey, current);
  }
  const donors = [...keyed.entries()]
    .map(([privateKey, donor]) => ({
      privateKey,
      donorName: donor.name,
      amount: donor.amount,
      donationCount: donor.count,
    }))
    .sort((left, right) =>
      right.amount - left.amount
      || left.donorName.localeCompare(right.donorName, "et")
      || left.privateKey.localeCompare(right.privateKey));
  const publicNameTotals = new Map<string, number>();
  for (const donor of donors) {
    publicNameTotals.set(donor.donorName, (publicNameTotals.get(donor.donorName) ?? 0) + 1);
  }
  const publicNameOccurrences = new Map<string, number>();
  const publicDonors = donors.map(({ privateKey: _privateKey, ...donor }) => {
    const occurrence = (publicNameOccurrences.get(donor.donorName) ?? 0) + 1;
    publicNameOccurrences.set(donor.donorName, occurrence);
    const ambiguousIdentity = publicNameTotals.get(donor.donorName) !== 1;
    const publicIdentity = !ambiguousIdentity
      ? `${partyScope}|${donor.donorName}`
      : `${partyScope}|ambiguous|${donor.donorName}|${donor.amount}|${donor.donationCount}|${occurrence}`;
    return {
      id: `donor-${politicalFinanceHash(publicIdentity)}`,
      ambiguousIdentity,
      ...donor,
    };
  });
  const total = sumMoney(donations.map((row) => row.amount));
  const signatures = new Map<string, number>();
  const largestDonations = [...donations]
    .sort((left, right) =>
      right.amount - left.amount || (right.date ?? "").localeCompare(left.date ?? ""))
    .slice(0, 8)
    .map((row) => {
      const signature = `${row.date}|${row.categoryName}|${row.reportedName}|${row.amount}`;
      const occurrence = (signatures.get(signature) ?? 0) + 1;
      signatures.set(signature, occurrence);
      return {
        id: `donation-${politicalFinanceHash(`${signature}|${occurrence}`)}`,
        donorName: row.reportedName,
        amount: row.amount,
        date: row.date,
        category: row.categoryName,
      };
    });
  return {
    concentration: total > 0 && donations.every((row) => row.amount >= 0)
      ? percentage(sumMoney(publicDonors.slice(0, 5).map((donor) => donor.amount)), total)
      : null,
    largestDonations,
    largestDonors: publicDonors.slice(0, 8),
    roundingTolerance: donations.length * 0.5 + 0.01,
    total,
  };
}

export function buildPoliticalFinanceSummaries(
  rows: readonly PoliticalFinanceAggregateRow[],
  details: readonly PoliticalFinanceDetailBundle[],
  latestPeriod: PoliticalFinancePeriod,
  coverage: PoliticalFinanceAggregateCoverage,
  sourceAdapter: PoliticalFinanceSourceAdapter,
): PoliticalFinancePartySummary[] {
  const periods = [...new Set(rows.map((row) => row.period))].sort(periodSort).slice(-8);
  const latestPartyIds = [...new Set(
    rows.filter((row) => row.period === latestPeriod).map((row) => row.sourcePartyId),
  )];

  return latestPartyIds.map((sourcePartyId) => {
    const partyRows = rows.filter((row) => row.sourcePartyId === sourcePartyId);
    const sourceName = partyRows.find((row) => row.sourcePartyName)?.sourcePartyName
      ?? sourcePartyId;
    const presentation = sourceAdapter.partyPresentation(sourcePartyId, sourceName);
    const current = partyRows.filter((row) => row.period === latestPeriod);
    const incomeRows = current.filter((row) => row.kind === "income");
    const hasIncome = coverage.has(aggregateCoverageKey(latestPeriod, "income"));
    const hasExpenses = coverage.has(aggregateCoverageKey(latestPeriod, "expense"));
    const income = hasIncome ? sumMoney(incomeRows.map((row) => row.amount)) : null;
    const expenses = hasExpenses
      ? sumMoney(current.filter((row) => row.kind === "expense").map((row) => row.amount))
      : null;
    const donations = hasIncome
      ? sumMoney(incomeRows
        .filter((row) => DONATION_CATEGORIES.has(row.categoryName))
        .map((row) => row.amount))
      : null;
    const detail = details.find((entry) =>
      entry.sourcePartyId === sourcePartyId && entry.period === latestPeriod);
    const donationDetail = detail ? donationViews(detail.receipts, sourcePartyId) : null;
    const sourceReportId = detail?.reportId ?? null;
    const filingId = `erjk:${sourcePartyId}:${latestPeriod}`;
    const revisionMaterial = [
      sourceReportId ?? "none",
      ...current.map((row) => `${row.kind}|${row.categoryId}|${row.amount}`).sort(),
      ...(detail?.receipts ?? [])
        .map((row) => `${row.date}|${row.categoryName}|${row.reportedName}|${row.amount}`)
        .sort(),
    ].join(";");
    return {
      ...presentation,
      sourcePartyId,
      sourceName,
      filing: {
        id: filingId,
        revisionId: `${filingId}:${politicalFinanceHash(revisionMaterial)}`,
        period: latestPeriod,
        sourceReportId,
        sourceUrl: sourceAdapter.filingSourceUrl(sourcePartyId, sourceReportId),
      },
      income,
      expenses,
      donations,
      donationSharePct: donations !== null && income !== null
        ? percentage(donations, income)
        : null,
      donorConcentrationTop5Pct: donationDetail?.concentration ?? null,
      detailReconciles: donationDetail && donations !== null
        ? Math.abs(donationDetail.total - donations) <= donationDetail.roundingTolerance
        : null,
      incomeCategories: hasIncome ? incomeRows
        .map((row) => ({
          id: row.categoryId,
          name: row.categoryName,
          amount: row.amount,
          sharePct: percentage(row.amount, income ?? 0),
        }))
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
            ? sumMoney(periodRows
              .filter((row) => row.kind === "income")
              .map((row) => row.amount))
            : null,
          expenses: periodHasExpenses
            ? sumMoney(periodRows
              .filter((row) => row.kind === "expense")
              .map((row) => row.amount))
            : null,
          donations: periodHasIncome
            ? sumMoney(periodRows
              .filter((row) =>
                row.kind === "income" && DONATION_CATEGORIES.has(row.categoryName))
              .map((row) => row.amount))
            : null,
        };
      }),
    };
  }).sort((left, right) => {
    if (left.income === null) {
      return right.income === null ? left.name.localeCompare(right.name, "et") : 1;
    }
    if (right.income === null) return -1;
    return right.income - left.income || left.name.localeCompare(right.name, "et");
  });
}
