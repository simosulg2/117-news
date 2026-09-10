import "server-only";

import {
  type IntradayPrice,
  type XetraMarketData,
} from "../model/market-opportunities";
import type { MarketInstrument } from "../model/market-instruments";
import { readBoundedResponseText } from "../../../lib/bounded-response";

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"] as const;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CHART_BYTES = 250_000;
const MAX_SPARK_BYTES = 4_000_000;
const LIVE_CONCURRENCY = 12;

type JsonRecord = Record<string, unknown>;

export type YahooMarketData = Readonly<{
  xetra: ReadonlyMap<string, XetraMarketData>;
  us: ReadonlyMap<string, IntradayPrice>;
  eurUsd: IntradayPrice | null;
}>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function firstRecord(value: unknown): JsonRecord | null {
  return Array.isArray(value) ? record(value[0]) : null;
}

async function fetchJson(path: string, maximumBytes: number): Promise<unknown> {
  let lastError: unknown;
  for (const host of YAHOO_HOSTS) {
    try {
      const response = await fetch(`https://${host}${path}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "117.ee private market dashboard (+https://117.ee)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`Yahoo HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("json")) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("Yahoo returned a non-JSON response");
      }
      return JSON.parse(await readBoundedResponseText(response, maximumBytes)) as unknown;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Yahoo request failed");
}

function chartFromEnvelope(input: unknown): JsonRecord | null {
  const root = record(input);
  const chart = record(root?.chart);
  return firstRecord(chart?.result);
}

function metaPrice(chart: JsonRecord | null): IntradayPrice | null {
  const meta = record(chart?.meta);
  const value = finiteNumber(meta?.regularMarketPrice);
  const timestamp = finiteNumber(meta?.regularMarketTime);
  if (value === null || value <= 0 || timestamp === null) return null;
  return { value, at: new Date(timestamp * 1_000) };
}

function hasExpectedMeta(
  chart: JsonRecord | null,
  symbol: string,
  currency: "EUR" | "USD",
): boolean {
  const meta = record(chart?.meta);
  if (meta?.symbol !== symbol || meta.currency !== currency) return false;
  if (currency === "EUR") {
    return meta.fullExchangeName === "XETRA" || meta.exchangeName === "GER";
  }
  return true;
}

function intradayPrices(chart: JsonRecord | null): readonly IntradayPrice[] {
  const timestamps = chart?.timestamp;
  const indicators = record(chart?.indicators);
  const quote = firstRecord(indicators?.quote);
  const closes = quote?.close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) return [];
  const prices: IntradayPrice[] = [];
  const length = Math.min(timestamps.length, closes.length);
  for (let index = 0; index < length; index += 1) {
    const timestamp = finiteNumber(timestamps[index]);
    const value = finiteNumber(closes[index]);
    if (timestamp === null || value === null || value <= 0) continue;
    prices.push({ value, at: new Date(timestamp * 1_000) });
  }
  return prices;
}

function isClosingAuctionTime(date: Date): boolean {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return Number(parts.hour) * 60 + Number(parts.minute) >= 17 * 60 + 30;
}

function parseXetraChart(chart: JsonRecord | null, symbol: string): XetraMarketData | null {
  if (!hasExpectedMeta(chart, symbol, "EUR")) return null;
  const prices = intradayPrices(chart);
  if (prices.length === 0) return null;
  const latest = metaPrice(chart);
  return {
    prices,
    auction: latest && isClosingAuctionTime(latest.at) ? latest : null,
  };
}

async function fetchChart(symbol: string, interval: "1m" | "1d"): Promise<JsonRecord | null> {
  const encoded = encodeURIComponent(symbol);
  const input = await fetchJson(
    `/v8/finance/chart/${encoded}?interval=${interval}&range=1d&includePrePost=false`,
    MAX_CHART_BYTES,
  );
  return chartFromEnvelope(input);
}

async function fetchXetraBatch(
  instruments: readonly MarketInstrument[],
): Promise<Map<string, XetraMarketData>> {
  const symbols = instruments.map((instrument) => instrument.xetraSymbol).join(",");
  const parameters = new URLSearchParams({
    symbols,
    range: "1d",
    interval: "1m",
    _: String(Math.floor(Date.now() / 60_000)),
  });
  const input = await fetchJson(`/v7/finance/spark?${parameters}`, MAX_SPARK_BYTES);
  const spark = record(record(input)?.spark);
  if (!Array.isArray(spark?.result)) throw new Error("Yahoo spark result missing");
  const result = new Map<string, XetraMarketData>();
  for (const itemValue of spark.result) {
    const item = record(itemValue);
    const symbol = typeof item?.symbol === "string" ? item.symbol : null;
    const chart = firstRecord(item?.response);
    if (!symbol) continue;
    const parsed = parseXetraChart(chart, symbol);
    if (parsed) result.set(symbol, parsed);
  }
  return result;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  worker: (value: T) => Promise<R>,
): Promise<readonly R[]> {
  const result: R[] = [];
  for (let index = 0; index < values.length; index += LIVE_CONCURRENCY) {
    const chunk = values.slice(index, index + LIVE_CONCURRENCY);
    result.push(...await Promise.all(chunk.map(worker)));
  }
  return result;
}

async function fetchXetraFallback(
  instruments: readonly MarketInstrument[],
): Promise<Map<string, XetraMarketData>> {
  const entries = await mapWithConcurrency(instruments, async (instrument) => {
    try {
      const parsed = parseXetraChart(
        await fetchChart(instrument.xetraSymbol, "1m"),
        instrument.xetraSymbol,
      );
      return [instrument.xetraSymbol, parsed] as const;
    } catch {
      return [instrument.xetraSymbol, null] as const;
    }
  });
  return new Map(entries.filter(
    (entry): entry is readonly [string, XetraMarketData] => entry[1] !== null,
  ));
}

async function fetchLivePrices(symbols: readonly string[]): Promise<Map<string, IntradayPrice>> {
  const unique = [...new Set(symbols)];
  const entries = await mapWithConcurrency(unique, async (symbol) => {
    try {
      const chart = await fetchChart(symbol, "1d");
      const price = hasExpectedMeta(chart, symbol, "USD") ? metaPrice(chart) : null;
      return [symbol, price] as const;
    } catch {
      return [symbol, null] as const;
    }
  });
  return new Map(entries.filter(
    (entry): entry is readonly [string, IntradayPrice] => entry[1] !== null,
  ));
}

export async function loadYahooMarketData(
  instruments: readonly MarketInstrument[],
): Promise<YahooMarketData> {
  const xetraPromise = fetchXetraBatch(instruments).catch(
    () => fetchXetraFallback(instruments),
  );
  const livePromise = fetchLivePrices([
    ...instruments.map((instrument) => instrument.usSymbol),
    "EURUSD=X",
  ]);
  const [xetra, live] = await Promise.all([xetraPromise, livePromise]);
  return {
    xetra,
    us: new Map(
      instruments.flatMap((instrument) => {
        const price = live.get(instrument.usSymbol);
        return price ? [[instrument.usSymbol, price] as const] : [];
      }),
    ),
    eurUsd: live.get("EURUSD=X") ?? null,
  };
}
