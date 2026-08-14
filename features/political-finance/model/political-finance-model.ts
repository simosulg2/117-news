import type {
  PoliticalFinancePartySummary,
  PoliticalFinancePeriod,
  PoliticalFinanceRecord,
} from "../../../lib/political-finance-types";

export type PoliticalFinanceAggregateRow = {
  kind: "income" | "expense";
  period: PoliticalFinancePeriod;
  sourcePartyId: string;
  sourcePartyName: string;
  categoryId: string;
  categoryName: string;
  amount: number;
};

export type PoliticalFinanceReceiptRow = {
  date: string | null;
  categoryName: string;
  reportedName: string;
  counterpartyKey: string;
  amount: number;
};

export type PoliticalFinanceExpenseRow = {
  categoryName: string;
  amount: number;
};

export type PoliticalFinanceDetailBundle = {
  sourcePartyId: string;
  period: PoliticalFinancePeriod;
  reportId: number;
  receipts: PoliticalFinanceReceiptRow[];
};

export type PoliticalFinanceAggregateCoverage = ReadonlySet<
  `${PoliticalFinancePeriod}:${"income" | "expense"}`
>;

export type PoliticalFinanceSourceAdapter = {
  partyPresentation: (
    sourcePartyId: string,
    sourceName: string,
  ) => Pick<
    PoliticalFinancePartySummary,
    "id" | "canonicalPartyId" | "name" | "shortName" | "color"
  >;
  filingSourceUrl: (sourcePartyId: string, reportId: number | null) => string;
};

export const DONATION_CATEGORIES = new Set(["Rahaline annetus", "Mitterahaline annetus"]);

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

export function politicalFinanceHash(input: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value = Math.imul(value ^ input.charCodeAt(index), 0x01000193);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

export function recordsRevisionId(
  filingId: string,
  records: readonly PoliticalFinanceRecord[],
): string {
  const material = records
    .map((record) => `${record.id}|${record.categoryId}|${record.date}|${record.amount}`)
    .sort()
    .join(";");
  return `${filingId}:${politicalFinanceHash(material)}`;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumMoney(values: readonly number[]): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

export function percentage(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1_000) / 10;
}

export function sortedReceiptRows(
  rows: readonly PoliticalFinanceReceiptRow[],
): PoliticalFinanceReceiptRow[] {
  return [...rows].sort((left, right) =>
    `${right.date ?? ""}|${right.categoryName}|${right.reportedName}|${right.amount}|${right.counterpartyKey}`.localeCompare(
      `${left.date ?? ""}|${left.categoryName}|${left.reportedName}|${left.amount}|${left.counterpartyKey}`,
      "et",
    ));
}
