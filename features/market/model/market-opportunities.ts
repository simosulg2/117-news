import type {
  MarketOpportunity,
  MarketPrice,
  MarketWindowState,
} from "../../../lib/market-types.ts";

import type { MarketInstrument } from "./market-instruments.ts";

const BERLIN_TIME_ZONE = "Europe/Berlin";
const TALLINN_TIME_ZONE = "Europe/Tallinn";
const XETRA_REFERENCE_MINUTE = 17 * 60 + 30;
const COMPETITION_WINDOW_START_MINUTE = 18 * 60 + 30;
const COMPETITION_DEADLINE_MINUTE = 20 * 60;
export const LIVE_QUOTE_MAX_AGE_SECONDS = 180;
export const TRADE_FEE_EUR = 2.5;
export const MINIMUM_TRADE_EUR = 100;
export const PRICE_SAFETY_MARGIN_PERCENT = 0.2;

export type TradingSignal = Readonly<{
  direction: "buy" | "sell";
  grossEdgeEur: number;
  netAfterRoundTripEur: number;
  strong: boolean;
}>;

export type IntradayPrice = Readonly<{
  value: number;
  at: Date;
}>;

export type XetraMarketData = Readonly<{
  prices: readonly IntradayPrice[];
  auction: IntradayPrice | null;
}>;

type ZonedParts = Readonly<{
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
  second: number;
}>;

const formatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, timeZone: string): ZonedParts {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  const values = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: values.weekday ?? "",
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function dateKey(parts: ZonedParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function minuteOfDay(parts: ZonedParts): number {
  return parts.hour * 60 + parts.minute;
}

export function getMarketWindowState(now: Date): MarketWindowState {
  const parts = zonedParts(now, TALLINN_TIME_ZONE);
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return "weekend";
  const minute = minuteOfDay(parts);
  if (minute < COMPETITION_WINDOW_START_MINUTE) return "before";
  if (minute < COMPETITION_DEADLINE_MINUTE) return "open";
  return "closed";
}

export function calculateTradingSignal(
  gapPercent: number,
  tradeAmountEur: number,
  minimumGapPercent: number,
): TradingSignal {
  const amount = Number.isFinite(tradeAmountEur)
    ? Math.max(MINIMUM_TRADE_EUR, tradeAmountEur)
    : MINIMUM_TRADE_EUR;
  const threshold = Number.isFinite(minimumGapPercent)
    ? Math.max(0, minimumGapPercent)
    : 0;
  const absoluteGap = Math.abs(gapPercent);
  const grossEdgeEur = amount * absoluteGap / 100;
  const netAfterRoundTripEur = grossEdgeEur - 2 * TRADE_FEE_EUR;
  return {
    direction: gapPercent >= 0 ? "buy" : "sell",
    grossEdgeEur,
    netAfterRoundTripEur,
    strong: absoluteGap >= threshold + PRICE_SAFETY_MARGIN_PERCENT
      && netAfterRoundTripEur > 0,
  };
}

export function selectPreAuctionReference(
  prices: readonly IntradayPrice[],
): IntradayPrice | null {
  const eligible = prices.filter((price) => {
    const parts = zonedParts(price.at, BERLIN_TIME_ZONE);
    return minuteOfDay(parts) < XETRA_REFERENCE_MINUTE;
  });
  if (eligible.length === 0) return null;
  const newestDate = eligible.reduce((latest, price) => {
    const key = dateKey(zonedParts(price.at, BERLIN_TIME_ZONE));
    return key > latest ? key : latest;
  }, "");
  return eligible.reduce<IntradayPrice | null>((latest, price) => {
    const parts = zonedParts(price.at, BERLIN_TIME_ZONE);
    if (dateKey(parts) !== newestDate) return latest;
    return !latest || price.at > latest.at ? price : latest;
  }, null);
}

function asMarketPrice(price: IntradayPrice | null): MarketPrice | null {
  return price ? { value: price.value, at: price.at.toISOString() } : null;
}

function ageSeconds(price: IntradayPrice | null, now: Date): number | null {
  if (!price) return null;
  return Math.max(0, Math.round((now.getTime() - price.at.getTime()) / 1_000));
}

export function buildMarketOpportunity(
  instrument: MarketInstrument,
  xetra: XetraMarketData | null,
  usPrice: IntradayPrice | null,
  eurUsd: IntradayPrice | null,
  now: Date,
): MarketOpportunity {
  const reference = xetra ? selectPreAuctionReference(xetra.prices) : null;
  const today = dateKey(zonedParts(now, BERLIN_TIME_ZONE));
  const referenceIsToday = reference
    ? dateKey(zonedParts(reference.at, BERLIN_TIME_ZONE)) === today
    : false;
  const usQuoteAgeSeconds = ageSeconds(usPrice, now);
  const fxAgeSeconds = ageSeconds(eurUsd, now);
  const issues: string[] = [];

  if (!reference) issues.push("Xetra võrdlushind puudub");
  else if (!referenceIsToday) issues.push("Xetra võrdlushind ei ole tänane");
  if (!usPrice) issues.push("USA hind puudub");
  else if (usQuoteAgeSeconds !== null && usQuoteAgeSeconds > LIVE_QUOTE_MAX_AGE_SECONDS) {
    issues.push("USA hind on vananenud");
  }
  if (!eurUsd) issues.push("EUR/USD kurss puudub");
  else if (fxAgeSeconds !== null && fxAgeSeconds > LIVE_QUOTE_MAX_AGE_SECONDS) {
    issues.push("EUR/USD kurss on vananenud");
  }

  let referenceTradeMinutesBeforeClose: number | null = null;
  if (reference) {
    const parts = zonedParts(reference.at, BERLIN_TIME_ZONE);
    referenceTradeMinutesBeforeClose = Math.max(
      0,
      Math.ceil(XETRA_REFERENCE_MINUTE - minuteOfDay(parts) - parts.second / 60),
    );
    if (referenceTradeMinutesBeforeClose > 30) {
      issues.push("Xetra viimane tehing oli üle 30 minuti enne lõppu");
    }
  }

  const usable = reference && usPrice && eurUsd
    && reference.value > 0 && usPrice.value > 0 && eurUsd.value > 0;
  const impliedEur = usable
    ? usPrice.value / instrument.usUnits / eurUsd.value
    : null;
  const gapPercent = impliedEur !== null && reference
    ? ((impliedEur / reference.value) - 1) * 100
    : null;

  return {
    ...instrument,
    reference: asMarketPrice(reference),
    auction: asMarketPrice(xetra?.auction ?? null),
    usPrice: asMarketPrice(usPrice),
    impliedEur,
    gapPercent,
    referenceTradeMinutesBeforeClose,
    referenceIsToday,
    usQuoteAgeSeconds,
    issues,
  };
}
