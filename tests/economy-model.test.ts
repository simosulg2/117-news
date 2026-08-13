import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEconomyIndicator,
  deriveAnnualPercentageSeries,
  normalizeSeriesPoints,
  previousPeriodId,
  summarizeEconomy,
  yearAgoPeriodId,
} from "../features/economy/model/economy-indicators.ts";
import type { EconomyGroup, EconomyPeriod, EconomySourceReference } from "../lib/economy-types.ts";

const source: EconomySourceReference = {
  providerId: "statistics-estonia",
  providerName: "Statistikaamet",
  tableId: "TEST",
  tableTitle: "Test table",
  tableUrl: "https://andmed.stat.ee/et/stat/TEST",
  apiUrl: "https://andmed.stat.ee/api/v1/et/stat/TEST",
  updatedAt: "2026-08-01T00:00:00.000Z",
  retrievedAt: "2026-08-02T00:00:00.000Z",
  attribution: "Statistikaamet",
  licenceName: "CC BY-SA 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  revisionPolicy: "latest-source-value",
};

function period(id: string, frequency: "monthly" | "quarterly" = "quarterly"): EconomyPeriod {
  return { id, label: id, frequency };
}

function indicator(points: Array<[string, number]>, direction: "higher" | "lower" | "target-2" | "neutral" = "higher") {
  return buildEconomyIndicator({
    id: "test",
    groupId: "output",
    label: "Test",
    description: "Test indicator",
    frequency: "quarterly",
    geographyCode: "EE",
    geographyLabel: "Eesti",
    unit: { id: "percent", label: "protsenti", symbol: "%", decimals: 1 },
    priceBasis: "not-applicable",
    seasonalAdjustment: "unadjusted",
    points: points.map(([id, value]) => ({ period: period(id), value })),
    comparisonKind: "percentage-point",
    preferredDirection: direction,
    source,
  });
}

test("period helpers cross year boundaries", () => {
  assert.equal(previousPeriodId(period("2026Q1")), "2025Q4");
  assert.equal(previousPeriodId(period("2026M01", "monthly")), "2025M12");
  assert.equal(yearAgoPeriodId(period("2026Q2")), "2025Q2");
  assert.equal(yearAgoPeriodId(period("2026M07", "monthly")), "2025M07");
});

test("quarterly comparisons require exact adjacent and annual periods", () => {
  const result = indicator([["2025Q1", 100], ["2025Q4", 115], ["2026Q1", 120]]);
  assert.equal(result.previousPeriod?.value, 5);
  assert.equal(result.previousPeriod?.referencePeriod.id, "2025Q4");
  assert.equal(result.yearOverYear?.value, 20);
  assert.equal(result.classification.outlook, "improved");
});

test("missing comparison periods stay null instead of matching a nearby value", () => {
  const result = indicator([["2025Q3", 100], ["2026Q1", 120]]);
  assert.equal(result.previousPeriod, null);
  assert.equal(result.yearOverYear, null);
  assert.equal(result.classification.outlook, "neutral");
});

test("direction classification treats lower unemployment as improved", () => {
  const result = indicator([["2025Q1", 8.2], ["2026Q1", 6.9]], "lower");
  assert.equal(result.classification.outlook, "improved");
  const worse = indicator([["2025Q1", 6.9], ["2026Q1", 8.2]], "lower");
  assert.equal(worse.classification.outlook, "worsened");
});

test("inflation classification compares distance from two percent", () => {
  assert.equal(indicator([["2025Q1", 6], ["2026Q1", 3]], "target-2").classification.outlook, "improved");
  assert.equal(indicator([["2025Q1", 2], ["2026Q1", 4]], "target-2").classification.outlook, "worsened");
});

test("duplicate periods retain the last revision and mark it", () => {
  const points = normalizeSeriesPoints([
    { period: period("2026Q1"), value: 100 },
    { period: period("2026Q1"), value: 101 },
  ]);
  assert.equal(points.length, 1);
  assert.equal(points[0].value, 101);
  assert.equal(points[0].revised, true);
  assert.equal(indicator([["2025Q1", 90], ["2026Q1", 100], ["2026Q1", 101]]).current?.revision, "revised-in-response");
});

test("annual index transformation matches same month, not latest available", () => {
  const points = deriveAnnualPercentageSeries([
    { period: period("2025M06", "monthly"), value: 100 },
    { period: period("2025M07", "monthly"), value: 110 },
    { period: period("2026M07", "monthly"), value: 121 },
  ]);
  assert.equal(points[0].period.id, "2026M07");
  assert.ok(Math.abs(points[0].value - 10) < 1e-10);
});

test("summary counts available outlooks across independent groups", () => {
  const indicators = [
    indicator([["2025Q1", 100], ["2026Q1", 110]], "higher"),
    indicator([["2025Q1", 100], ["2026Q1", 110]], "lower"),
    indicator([["2025Q1", 100], ["2026Q1", 100]], "higher"),
  ];
  const group: EconomyGroup = {
    id: "output", label: "Output", description: "", status: "ok", indicators, source, message: null,
  };
  assert.deepEqual(summarizeEconomy([group]), {
    improved: 1,
    worsened: 1,
    neutral: 1,
    unavailable: 0,
    considered: 3,
    methodology: "Suund on määratud näitajapõhiselt aastavõrdlusest; inflatsiooni kogunäitaja puhul mõõdetakse lähedust 2% orientiirile.",
  });
});
