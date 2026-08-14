import type {
  PoliticalFinancePeriod,
  PoliticalFinanceRecord,
  PoliticalFinanceRecordType,
} from "../../../lib/political-finance-types";
import {
  categoryId,
  DONATION_CATEGORIES,
  politicalFinanceHash,
  sortedReceiptRows,
  type PoliticalFinanceExpenseRow,
  type PoliticalFinanceReceiptRow,
} from "./political-finance-model.ts";

export function buildPoliticalFinanceRecords(args: {
  partyId: string;
  sourcePartyId: string;
  period: PoliticalFinancePeriod;
  reportId: number;
  recordType: PoliticalFinanceRecordType;
  sourceUrl: string;
  receipts?: readonly PoliticalFinanceReceiptRow[];
  expenses?: readonly PoliticalFinanceExpenseRow[];
}): PoliticalFinanceRecord[] {
  const candidates = args.recordType === "expenses"
    ? (args.expenses ?? []).map((row) => ({
      categoryName: row.categoryName,
      reportedName: null,
      date: null,
      amount: row.amount,
      type: "expense" as const,
    }))
    : sortedReceiptRows(args.receipts ?? [])
      .filter((row) =>
        args.recordType === "income" || DONATION_CATEGORIES.has(row.categoryName))
      .map((row) => ({
        categoryName: row.categoryName,
        reportedName: row.reportedName,
        date: row.date,
        amount: row.amount,
        type: DONATION_CATEGORIES.has(row.categoryName) ? "donation" as const : "income" as const,
      }));
  const occurrences = new Map<string, number>();
  const filingId = `erjk:${args.sourcePartyId}:${args.period}`;
  return candidates.map((row) => {
    const signature = `${row.date}|${row.categoryName}|${row.reportedName}|${row.amount}`;
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    return {
      id: `erjk-record-${politicalFinanceHash(`${filingId}|${signature}|${occurrence}`)}`,
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
      sourceUrl: args.sourceUrl,
    };
  });
}
