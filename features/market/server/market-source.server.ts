import "server-only";

import { MARKET_INSTRUMENTS } from "../model/market-instruments";
import {
  buildMarketOpportunity,
  getMarketWindowState,
} from "../model/market-opportunities";
import { loadYahooMarketData } from "./yahoo-market-source.server";
import type { MarketSnapshot } from "../../../lib/market-types";

const SNAPSHOT_TTL_MS = 20_000;

let cachedSnapshot: MarketSnapshot | null = null;
let cacheExpiresAt = 0;
let pendingSnapshot: Promise<MarketSnapshot> | null = null;

function quoteAgeSeconds(at: Date | null, now: Date): number | null {
  return at ? Math.max(0, Math.round((now.getTime() - at.getTime()) / 1_000)) : null;
}

async function refreshSnapshot(): Promise<MarketSnapshot> {
  const now = new Date();
  const data = await loadYahooMarketData(MARKET_INSTRUMENTS);
  const opportunities = MARKET_INSTRUMENTS.map((instrument) => buildMarketOpportunity(
    instrument,
    data.xetra.get(instrument.xetraSymbol) ?? null,
    data.us.get(instrument.usSymbol) ?? null,
    data.eurUsd,
    now,
  )).sort((left, right) => {
    const leftGap = left.gapPercent === null ? -Infinity : Math.abs(left.gapPercent);
    const rightGap = right.gapPercent === null ? -Infinity : Math.abs(right.gapPercent);
    return rightGap - leftGap;
  });
  const availableCount = opportunities.filter(
    (opportunity) => opportunity.gapPercent !== null,
  ).length;

  return {
    fetchedAt: now.toISOString(),
    window: getMarketWindowState(now),
    eurUsd: data.eurUsd
      ? { value: data.eurUsd.value, at: data.eurUsd.at.toISOString() }
      : null,
    eurUsdAgeSeconds: quoteAgeSeconds(data.eurUsd?.at ?? null, now),
    opportunities,
    availableCount,
    instrumentCount: MARKET_INSTRUMENTS.length,
    source: "yahoo",
  };
}

export async function loadMarketSnapshot(): Promise<MarketSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now < cacheExpiresAt) return cachedSnapshot;
  if (pendingSnapshot) return pendingSnapshot;

  pendingSnapshot = refreshSnapshot().then((snapshot) => {
    if (snapshot.availableCount > 0 || !cachedSnapshot) cachedSnapshot = snapshot;
    cacheExpiresAt = Date.now() + SNAPSHOT_TTL_MS;
    return cachedSnapshot ?? snapshot;
  }).finally(() => {
    pendingSnapshot = null;
  });
  return pendingSnapshot;
}
