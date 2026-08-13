import type { PoliticalFinancePeriod } from "../../../lib/political-finance-types";

export class ErjkParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErjkParseError";
  }
}

export type ErjkAggregateRow = {
  kind: "income" | "expense";
  period: PoliticalFinancePeriod;
  sourcePartyId: string;
  sourcePartyName: string;
  categoryId: string;
  categoryName: string;
  amount: number;
};

export type ErjkReportReference = {
  reportId: number;
  period: PoliticalFinancePeriod;
};

export type ErjkReceiptRow = {
  date: string | null;
  categoryName: string;
  reportedName: string;
  counterpartyKey: string;
  amount: number;
};

export type ErjkExpenseRow = {
  categoryName: string;
  amount: number;
};

function record(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ErjkParseError(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, context: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ErjkParseError(`${context} must be a non-empty string`);
  }
  return value.trim();
}

function amount(value: unknown, context: string): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || Math.abs(parsed) > 1_000_000_000_000) {
    throw new ErjkParseError(`${context} must be a finite monetary amount`);
  }
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) throw new ErjkParseError(`${context} must be an array`);
  return value;
}

function opaqueCounterpartyKey(name: string, discriminator: unknown): string {
  const input = `${name.trim().toLocaleUpperCase("et-EE")}|${typeof discriminator === "string" ? discriminator : ""}`;
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `erjk-person-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) throw new ErjkParseError("ERJK record date has an unknown format");
  const result = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${result}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result) {
    throw new ErjkParseError("ERJK record date is invalid");
  }
  return result;
}

export function parseErjkAggregateRows(
  input: unknown,
  kind: "income" | "expense",
  period: PoliticalFinancePeriod,
): ErjkAggregateRow[] {
  return array(input, "ERJK aggregate response").map((item, index) => {
    const row = record(item, `ERJK aggregate row ${index}`);
    return {
      kind,
      period,
      sourcePartyId: text(row.party_id, `row ${index} party_id`),
      sourcePartyName: text(row.party_name, `row ${index} party_name`),
      categoryId: kind === "income" ? text(row.category_id, `row ${index} category_id`) : "expenses-total",
      categoryName: kind === "income" ? text(row.category_name, `row ${index} category_name`) : "Kulud kokku",
      amount: amount(row.amount, `row ${index} amount`),
    };
  });
}

export function parseErjkReportReferences(input: unknown): ErjkReportReference[] {
  return array(input, "ERJK report list").map((item, index) => {
    const row = record(item, `ERJK report reference ${index}`);
    const reportId = typeof row.report_id === "number" ? row.report_id : Number(row.report_id);
    if (!Number.isSafeInteger(reportId) || reportId <= 0) {
      throw new ErjkParseError(`report reference ${index} has an invalid report_id`);
    }
    const match = /^(\d{4}),\s*([1-4])\.\s*kvartal$/i.exec(text(row.report_date, `report ${index} date`));
    if (!match) throw new ErjkParseError(`report reference ${index} has an unknown period`);
    return { reportId, period: `${match[1]}-Q${match[2]}` as PoliticalFinancePeriod };
  });
}

export function parseErjkReceiptRows(input: unknown): ErjkReceiptRow[] {
  return array(input, "ERJK receipt report").map((item, index) => {
    const row = record(item, `ERJK receipt row ${index}`);
    const reportedName = text(row.name, `receipt ${index} name`);
    return {
      date: isoDate(row.date),
      categoryName: text(row.receipt_category, `receipt ${index} category`),
      reportedName,
      counterpartyKey: opaqueCounterpartyKey(reportedName, row.birthdate),
      amount: amount(row.amount, `receipt ${index} amount`),
    };
  });
}

export function parseErjkExpenseRows(input: unknown): ErjkExpenseRow[] {
  return array(input, "ERJK expense report").map((item, index) => {
    const row = record(item, `ERJK expense row ${index}`);
    return {
      categoryName: text(row.expense_category, `expense ${index} category`).replace(/^-+/, ""),
      amount: amount(row.amount, `expense ${index} amount`),
    };
  });
}
