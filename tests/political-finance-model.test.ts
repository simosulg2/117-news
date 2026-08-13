import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPoliticalFinanceRecords,
  buildPoliticalFinanceSummaries,
  aggregateCoverageKey,
  type ErjkAggregateCoverage,
  recordsRevisionId,
} from "../features/political-finance/model/political-finance-model.ts";
import type { ErjkAggregateRow, ErjkReceiptRow } from "../features/political-finance/server/erjk-parser.ts";
import { erjkPartyPresentation } from "../features/political-finance/server/erjk-config.ts";
import { collectAggregateResults } from "../features/political-finance/server/political-finance-overview.server.ts";

function aggregate(period: "2026-Q1" | "2026-Q2", categoryId: string, categoryName: string, amount: number, kind: "income" | "expense" = "income"): ErjkAggregateRow {
  return {
    kind,
    period,
    sourcePartyId: "158",
    sourcePartyName: "Eesti Reformierakond",
    categoryId,
    categoryName,
    amount,
  };
}

const receipts: ErjkReceiptRow[] = [
  { date: "2026-06-30", categoryName: "Rahaline annetus", reportedName: "Anu A", counterpartyKey: "person-a", amount: 600 },
  { date: "2026-06-20", categoryName: "Rahaline annetus", reportedName: "Bert B", counterpartyKey: "person-b", amount: 300 },
  { date: "2026-06-10", categoryName: "Rahaline annetus", reportedName: "Cris C", counterpartyKey: "person-c", amount: 100 },
];

function coverage(...entries: Array<["2026-Q1" | "2026-Q2", "income" | "expense"]>): ErjkAggregateCoverage {
  return new Set(entries.map(([period, kind]) => aggregateCoverageKey(period, kind)));
}

test("builds reconciled party totals, composition, concentration, and history", () => {
  const rows = [
    aggregate("2026-Q1", "111", "Rahaline annetus", 250),
    aggregate("2026-Q1", "113", "Riigitoetus", 750),
    aggregate("2026-Q1", "expenses-total", "Kulud kokku", 800, "expense"),
    aggregate("2026-Q2", "111", "Rahaline annetus", 1000),
    aggregate("2026-Q2", "113", "Riigitoetus", 1000),
    aggregate("2026-Q2", "expenses-total", "Kulud kokku", 1200, "expense"),
  ];
  const [party] = buildPoliticalFinanceSummaries(rows, [{
    sourcePartyId: "158", period: "2026-Q2", reportId: 519112, receipts,
  }], "2026-Q2", coverage(
    ["2026-Q1", "income"], ["2026-Q1", "expense"],
    ["2026-Q2", "income"], ["2026-Q2", "expense"],
  ));

  assert.equal(party.id, "reform");
  assert.equal(party.sourceName, "Eesti Reformierakond");
  assert.equal(party.income, 2000);
  assert.equal(party.expenses, 1200);
  assert.equal(party.donationSharePct, 50);
  assert.equal(party.donorConcentrationTop5Pct, 100);
  assert.equal(party.detailReconciles, true);
  assert.deepEqual(party.history.map((point) => point.period), ["2026-Q1", "2026-Q2"]);
  assert.equal(party.largestDonations[0].donorName, "Anu A");
});

test("a corrected report replaces the same filing and changes its revision", () => {
  const originalRows = [aggregate("2026-Q2", "111", "Rahaline annetus", 1000)];
  const original = buildPoliticalFinanceSummaries(originalRows, [{
    sourcePartyId: "158", period: "2026-Q2", reportId: 10, receipts,
  }], "2026-Q2", coverage(["2026-Q2", "income"]))[0];
  const correctedReceipts = receipts.map((row, index) => index === 0 ? { ...row, amount: 700 } : row);
  const correctedRows = [aggregate("2026-Q2", "111", "Rahaline annetus", 1100)];
  const corrected = buildPoliticalFinanceSummaries(correctedRows, [{
    sourcePartyId: "158", period: "2026-Q2", reportId: 11, receipts: correctedReceipts,
  }], "2026-Q2", coverage(["2026-Q2", "income"]))[0];

  assert.equal(original.filing.id, corrected.filing.id);
  assert.notEqual(original.filing.revisionId, corrected.filing.revisionId);
  assert.equal(corrected.filing.sourceReportId, 11);
});

test("same-name donors remain separate and exact duplicate records get unique IDs", () => {
  const sameNameRows: ErjkReceiptRow[] = [
    { date: "2026-06-30", categoryName: "Rahaline annetus", reportedName: "Sama Nimi", counterpartyKey: "person-one", amount: 100 },
    { date: "2026-06-30", categoryName: "Rahaline annetus", reportedName: "Sama Nimi", counterpartyKey: "person-two", amount: 200 },
  ];
  const party = buildPoliticalFinanceSummaries(
    [aggregate("2026-Q2", "111", "Rahaline annetus", 300)],
    [{ sourcePartyId: "158", period: "2026-Q2", reportId: 1, receipts: sameNameRows }],
    "2026-Q2",
    coverage(["2026-Q2", "income"]),
  )[0];
  assert.equal(party.largestDonors.length, 2);
  assert.equal(party.largestDonors.some((donor) => ["person-one", "person-two"].includes(donor.id)), false);
  assert.equal(party.largestDonors.every((donor) => donor.ambiguousIdentity), true);

  const duplicate = sameNameRows[0];
  const records = buildPoliticalFinanceRecords({
    partyId: "reform", sourcePartyId: "158", period: "2026-Q2", reportId: 1,
    recordType: "donations", receipts: [duplicate, duplicate],
  });
  assert.equal(records.length, 2);
  assert.notEqual(records[0].id, records[1].id);
  assert.equal(JSON.stringify(records).includes("person-one"), false);
  assert.match(recordsRevisionId(records[0].filingId, records), /^erjk:158:2026-Q2:/);
});

test("public donor IDs are scoped to the reporting party", () => {
  const sharedDonor: ErjkReceiptRow[] = [{
    date: "2026-06-30", categoryName: "Rahaline annetus", reportedName: "Sama Avalik Nimi",
    counterpartyKey: "private-source-key", amount: 100,
  }];
  const reform = buildPoliticalFinanceSummaries(
    [aggregate("2026-Q2", "111", "Rahaline annetus", 100)],
    [{ sourcePartyId: "158", period: "2026-Q2", reportId: 1, receipts: sharedDonor }],
    "2026-Q2", coverage(["2026-Q2", "income"]),
  )[0];
  const otherRows = [{ ...aggregate("2026-Q2", "111", "Rahaline annetus", 100), sourcePartyId: "175", sourcePartyName: "Eesti Keskerakond" }];
  const centre = buildPoliticalFinanceSummaries(
    otherRows,
    [{ sourcePartyId: "175", period: "2026-Q2", reportId: 2, receipts: sharedDonor }],
    "2026-Q2", coverage(["2026-Q2", "income"]),
  )[0];
  assert.notEqual(reform.largestDonors[0].id, centre.largestDonors[0].id);
  assert.equal(JSON.stringify([reform, centre]).includes("private-source-key"), false);
  assert.equal(reform.largestDonors[0].ambiguousIdentity, false);
  assert.equal(centre.largestDonors[0].ambiguousIdentity, false);
});

test("ambiguous same-name donor rows remain marked when corrections reorder them", () => {
  const first: ErjkReceiptRow[] = [
    { date: "2026-06-30", categoryName: "Rahaline annetus", reportedName: "Sama Nimi", counterpartyKey: "one", amount: 100 },
    { date: "2026-06-29", categoryName: "Rahaline annetus", reportedName: "Sama Nimi", counterpartyKey: "two", amount: 200 },
  ];
  const corrected = first.map((row) => ({ ...row, amount: row.amount === 100 ? 300 : 50 }));
  const make = (rows: ErjkReceiptRow[]) => buildPoliticalFinanceSummaries(
    [aggregate("2026-Q2", "111", "Rahaline annetus", rows.reduce((sum, row) => sum + row.amount, 0))],
    [{ sourcePartyId: "158", period: "2026-Q2", reportId: 1, receipts: rows }],
    "2026-Q2", coverage(["2026-Q2", "income"]),
  )[0].largestDonors;
  assert.equal(make(first).every((donor) => donor.ambiguousIdentity), true);
  assert.equal(make(corrected).every((donor) => donor.ambiguousIdentity), true);
});

test("unknown ERJK parties stay visible without a fabricated registry match", () => {
  const [party] = buildPoliticalFinanceSummaries([{
    ...aggregate("2026-Q2", "111", "Rahaline annetus", 10),
    sourcePartyId: "99999",
    sourcePartyName: "Uus ERJK aruandja",
  }], [], "2026-Q2", coverage(["2026-Q2", "income"]));
  assert.equal(party.id, "erjk-99999");
  assert.equal(party.canonicalPartyId, null);
  assert.equal(party.sourceName, "Uus ERJK aruandja");
});

test("a rejected latest aggregate is unavailable instead of a factual zero", () => {
  const rows = [
    aggregate("2026-Q2", "111", "Rahaline annetus", 1000),
    aggregate("2026-Q2", "expenses-total", "Kulud kokku", 700, "expense"),
  ];
  const detail = [{ sourcePartyId: "158", period: "2026-Q2" as const, reportId: 1, receipts }];

  const tasks = [
    { period: "2026-Q2" as const, kind: "income" as const, path: "/income" },
    { period: "2026-Q2" as const, kind: "expense" as const, path: "/expense" },
  ];
  const incomeRejected = collectAggregateResults(tasks, [
    { status: "rejected", reason: new Error("income unavailable") },
    { status: "fulfilled", value: rows.filter((row) => row.kind === "expense") },
  ]);
  const missingIncome = buildPoliticalFinanceSummaries(
    incomeRejected.rows,
    detail,
    "2026-Q2",
    incomeRejected.coverage,
  )[0];
  assert.equal(incomeRejected.failures, 1);
  assert.equal(missingIncome.income, null);
  assert.equal(missingIncome.donations, null);
  assert.equal(missingIncome.donationSharePct, null);
  assert.equal(missingIncome.expenses, 700);
  assert.equal(missingIncome.detailReconciles, null);
  assert.deepEqual(missingIncome.incomeCategories, []);
  assert.deepEqual(missingIncome.history[0], {
    period: "2026-Q2", income: null, expenses: 700, donations: null,
  });

  const expensesRejected = collectAggregateResults(tasks, [
    { status: "fulfilled", value: rows.filter((row) => row.kind === "income") },
    { status: "rejected", reason: new Error("expenses unavailable") },
  ]);
  const missingExpenses = buildPoliticalFinanceSummaries(
    expensesRejected.rows,
    detail,
    "2026-Q2",
    expensesRejected.coverage,
  )[0];
  assert.equal(missingExpenses.income, 1000);
  assert.equal(missingExpenses.donations, 1000);
  assert.equal(missingExpenses.expenses, null);
  assert.equal(missingExpenses.history[0].expenses, null);
});

test("ERJK numeric identities survive a label change and reject collisions", () => {
  assert.equal(erjkPartyPresentation("158", "Reformierakonna uus nimi").id, "reform");
  assert.throws(
    () => erjkPartyPresentation("158", "ISAMAA Erakond"),
    /different canonical parties/,
  );
});
