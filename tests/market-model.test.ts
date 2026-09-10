import assert from "node:assert/strict";
import test from "node:test";

import { MARKET_INSTRUMENTS } from "../features/market/model/market-instruments.ts";
import {
  buildMarketOpportunity,
  calculateTradingSignal,
  getMarketWindowState,
  selectPreAuctionReference,
  type IntradayPrice,
} from "../features/market/model/market-opportunities.ts";
import {
  buildMarketRows,
  filterAndSortMarketRows,
} from "../features/market/model/market-view-model.ts";
import type { MarketSnapshot } from "../lib/market-types.ts";

function price(value: number, iso: string): IntradayPrice {
  return { value, at: new Date(iso) };
}

test("recognizes the Tallinn competition window in summer and winter", () => {
  assert.equal(getMarketWindowState(new Date("2026-09-10T15:29:59Z")), "before");
  assert.equal(getMarketWindowState(new Date("2026-09-10T15:30:00Z")), "open");
  assert.equal(getMarketWindowState(new Date("2026-09-10T16:59:59Z")), "open");
  assert.equal(getMarketWindowState(new Date("2026-09-10T17:00:00Z")), "closed");
  assert.equal(getMarketWindowState(new Date("2026-12-01T16:30:00Z")), "open");
  assert.equal(getMarketWindowState(new Date("2026-09-12T16:00:00Z")), "weekend");
});

test("uses the final non-empty Xetra minute strictly before 17:30 Berlin", () => {
  const selected = selectPreAuctionReference([
    price(99, "2026-09-09T15:29:00Z"),
    price(100, "2026-09-10T15:28:00Z"),
    price(101, "2026-09-10T15:29:56Z"),
    price(102, "2026-09-10T15:30:00Z"),
    price(103, "2026-09-10T15:35:00Z"),
  ]);
  assert.equal(selected?.value, 101);
  assert.equal(selected?.at.toISOString(), "2026-09-10T15:29:56.000Z");
});

test("converts a U.S. quote to EUR and respects ADR units", () => {
  const instrument = MARKET_INSTRUMENTS.find((item) => item.id === "hsbc");
  assert.ok(instrument);
  const now = new Date("2026-09-10T15:31:00Z");
  const opportunity = buildMarketOpportunity(
    instrument,
    {
      prices: [price(10, "2026-09-10T15:29:00Z")],
      auction: price(10.02, "2026-09-10T15:35:00Z"),
    },
    price(60, "2026-09-10T15:30:30Z"),
    price(1.2, "2026-09-10T15:30:45Z"),
    now,
  );
  assert.equal(opportunity.impliedEur, 10);
  assert.equal(opportunity.gapPercent, 0);
  assert.equal(opportunity.referenceTradeMinutesBeforeClose, 1);
  assert.equal(opportunity.referenceIsToday, true);
  assert.deepEqual(opportunity.issues, []);
});

test("marks stale live inputs and old Xetra sessions", () => {
  const instrument = MARKET_INSTRUMENTS[0];
  const opportunity = buildMarketOpportunity(
    instrument,
    { prices: [price(100, "2026-09-09T15:29:00Z")], auction: null },
    price(120, "2026-09-10T15:20:00Z"),
    price(1.2, "2026-09-10T15:20:00Z"),
    new Date("2026-09-10T15:31:00Z"),
  );
  assert.equal(opportunity.referenceIsToday, false);
  assert.ok(opportunity.issues.includes("Xetra võrdlushind ei ole tänane"));
  assert.ok(opportunity.issues.includes("USA hind on vananenud"));
  assert.ok(opportunity.issues.includes("EUR/USD kurss on vananenud"));
});

test("signal threshold includes the safety margin and both transaction fees", () => {
  const weak = calculateTradingSignal(1.1, 500, 1);
  assert.equal(weak.netAfterRoundTripEur, 0.5);
  assert.equal(weak.strong, false);

  const strong = calculateTradingSignal(-1.3, 500, 1);
  assert.equal(strong.direction, "sell");
  assert.equal(strong.netAfterRoundTripEur, 1.5);
  assert.equal(strong.strong, true);
});

test("view rows require fresh data and the open window to be actionable", () => {
  const instrument = MARKET_INSTRUMENTS[0];
  const opportunity = buildMarketOpportunity(
    instrument,
    { prices: [price(100, "2026-09-10T15:29:00Z")], auction: null },
    price(122, "2026-09-10T15:30:30Z"),
    price(1.2, "2026-09-10T15:30:45Z"),
    new Date("2026-09-10T15:31:00Z"),
  );
  const snapshot: MarketSnapshot = {
    fetchedAt: "2026-09-10T15:31:00Z",
    window: "open",
    eurUsd: { value: 1.2, at: "2026-09-10T15:30:45Z" },
    eurUsdAgeSeconds: 15,
    opportunities: [opportunity],
    availableCount: 1,
    instrumentCount: 1,
    source: "yahoo",
  };
  const open = buildMarketRows(snapshot, 500, 1, "open")[0];
  assert.equal(open.reliable, true);
  assert.equal(open.highlighted, true);
  assert.equal(open.actionable, true);
  assert.equal(buildMarketRows(snapshot, 500, 1, "closed")[0].actionable, false);
});

test("filters and sorts the full instrument list", () => {
  const now = new Date("2026-09-10T15:31:00Z");
  const opportunities = [110, 90, 105].map((usPrice, index) => buildMarketOpportunity(
    MARKET_INSTRUMENTS[index],
    { prices: [price(100, "2026-09-10T15:29:00Z")], auction: null },
    price(usPrice, "2026-09-10T15:30:30Z"),
    price(1, "2026-09-10T15:30:45Z"),
    now,
  ));
  const snapshot: MarketSnapshot = {
    fetchedAt: now.toISOString(),
    window: "open",
    eurUsd: { value: 1, at: "2026-09-10T15:30:45Z" },
    eurUsdAgeSeconds: 15,
    opportunities: [
      opportunities[0],
      opportunities[1],
      { ...opportunities[2], usQuoteAgeSeconds: 900 },
    ],
    availableCount: 3,
    instrumentCount: 3,
    source: "yahoo",
  };
  const rows = buildMarketRows(snapshot, 500, 1);
  const ids = (result: ReadonlyArray<(typeof rows)[number]>) => result.map((row) => row.opportunity.id);

  assert.deepEqual(ids(filterAndSortMarketRows(rows, {
    showAll: true,
    query: "",
    directionFilter: "buy",
    sortOrder: "buy-gap",
  })), ["abbott", "alphabet"]);
  assert.deepEqual(ids(filterAndSortMarketRows(rows, {
    showAll: true,
    query: "ahla",
    directionFilter: "all",
    sortOrder: "absolute-gap",
  })), ["alibaba"]);
  assert.deepEqual(ids(filterAndSortMarketRows(rows, {
    showAll: true,
    query: "",
    directionFilter: "reliable",
    sortOrder: "name",
  })), ["abbott", "alibaba"]);
  assert.deepEqual(ids(filterAndSortMarketRows(rows, {
    showAll: false,
    query: "",
    directionFilter: "all",
    sortOrder: "sell-gap",
  })), ["alibaba", "abbott"]);
});

test("instrument map is unique, bounded, and points at exact source pages", () => {
  assert.equal(MARKET_INSTRUMENTS.length, 46);
  assert.equal(new Set(MARKET_INSTRUMENTS.map((item) => item.id)).size, 46);
  assert.equal(new Set(MARKET_INSTRUMENTS.map((item) => item.xetraSymbol)).size, 46);
  for (const instrument of MARKET_INSTRUMENTS) {
    assert.match(instrument.investingUrl, /^https:\/\/www\.investing\.com\//);
    assert.match(instrument.xetraSymbol, /^[A-Z0-9]+\.DE$/);
    assert.match(instrument.isin, /^[A-Z]{2}[A-Z0-9]{10}$/);
    assert.ok(instrument.usUnits === 1 || instrument.usUnits === 5);
  }
});
