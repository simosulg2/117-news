import assert from "node:assert/strict";
import test from "node:test";

import {
  ErjkParseError,
  parseErjkAggregateRows,
  parseErjkExpenseRows,
  parseErjkReceiptRows,
  parseErjkReportReferences,
} from "../features/political-finance/server/erjk-parser.ts";

test("parses the documented ERJK aggregate and report-list shapes", () => {
  const rows = parseErjkAggregateRows([{
    amount: "1234.56",
    party_id: "158",
    party_name: "Eesti Reformierakond",
    category_id: "111",
    category_name: "Rahaline annetus",
  }], "income", "2026-Q2");
  assert.deepEqual(rows, [{
    kind: "income",
    period: "2026-Q2",
    sourcePartyId: "158",
    sourcePartyName: "Eesti Reformierakond",
    categoryId: "111",
    categoryName: "Rahaline annetus",
    amount: 1234.56,
  }]);
  assert.deepEqual(parseErjkReportReferences([
    { report_id: 519112, report_date: "2026, 2. kvartal" },
  ]), [{ reportId: 519112, period: "2026-Q2" }]);
});

test("drops birth dates while retaining opaque separation for duplicate names", () => {
  const rows = parseErjkReceiptRows([
    { date: "30.06.2026", receipt_category: "Rahaline annetus", name: "SAMA NIMI", birthdate: "01.01.1970", amount: 100 },
    { date: "30.06.2026", receipt_category: "Rahaline annetus", name: "SAMA NIMI", birthdate: "02.02.1980", amount: 200 },
  ]);
  assert.equal(rows[0].date, "2026-06-30");
  assert.notEqual(rows[0].counterpartyKey, rows[1].counterpartyKey);
  assert.equal(JSON.stringify(rows).includes("birthdate"), false);
  assert.equal(JSON.stringify(rows).includes("01.01.1970"), false);
});

test("parses expense categories without ERJK hierarchy prefixes", () => {
  assert.deepEqual(parseErjkExpenseRows([
    { expense_category: "--Internetireklaam", amount: 12.5 },
  ]), [{ categoryName: "Internetireklaam", amount: 12.5 }]);
});

test("rejects malformed money, periods, and calendar dates", () => {
  assert.throws(() => parseErjkAggregateRows([
    { amount: "not-money", party_id: "158", party_name: "Reform", category_id: "111", category_name: "Annetus" },
  ], "income", "2026-Q2"), ErjkParseError);
  assert.throws(() => parseErjkReportReferences([
    { report_id: 1, report_date: "2026 summer" },
  ]), /unknown period/);
  assert.throws(() => parseErjkReceiptRows([
    { date: "31.02.2026", receipt_category: "Rahaline annetus", name: "Nimi", birthdate: "x", amount: 1 },
  ]), /date is invalid/);
});
