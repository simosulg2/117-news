import { readBoundedResponseText } from "../../../lib/bounded-response.ts";
import type { EconomySourceReference } from "../../../lib/economy-types.ts";

import type { EconomyTableDefinition } from "./economy-series.ts";
import { assertPxSchema, ParsedPxDataset } from "./pxweb-dataset.ts";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_DATASET_BYTES = 1_500_000;
const MAX_CATALOG_BYTES = 250_000;
const CATALOG_CACHE_MS = 60 * 60 * 1_000;
const APPROVED_HOST = "andmed.stat.ee";
const DEFAULT_RATE_LIMIT_DELAY_MS = 5 * 60 * 1_000;

type FetchLike = typeof fetch;
type CatalogCacheEntry = { expiresAt: number; promise: Promise<Record<string, string>> };
const catalogCache = new Map<string, CatalogCacheEntry>();
const rateLimitedUntil = new Map<string, number>();

export class StatisticsEstoniaError extends Error {
  readonly code: "network" | "timeout" | "http" | "rate-limited" | "content-type" | "invalid-json" | "schema";
  readonly retryAfterSeconds: number | null;

  constructor(code: StatisticsEstoniaError["code"], message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "StatisticsEstoniaError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type FetchedEconomyTable = {
  dataset: ParsedPxDataset;
  source: EconomySourceReference;
};

function assertApprovedUrl(rawUrl: string): void {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== APPROVED_HOST || !url.pathname.startsWith("/api/v1/et/")) {
    throw new StatisticsEstoniaError("schema", "Unapproved Statistics Estonia endpoint");
  }
}

function retryAfterSeconds(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) return Math.min(Number(value.trim()), 86_400);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1_000)) : null;
}

async function requestJson(
  url: string,
  init: RequestInit,
  maximumBytes: number,
  fetchImpl: FetchLike,
): Promise<unknown> {
  assertApprovedUrl(url);
  const blockedUntil = rateLimitedUntil.get(url) ?? 0;
  if (blockedUntil > Date.now()) {
    throw new StatisticsEstoniaError(
      "rate-limited",
      "Statistics Estonia rate limit is still active",
      Math.ceil((blockedUntil - Date.now()) / 1_000),
    );
  }
  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "User-Agent": "117.ee economy dashboard (+https://117.ee)",
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new StatisticsEstoniaError("timeout", "Statistics Estonia request timed out");
    }
    throw new StatisticsEstoniaError("network", "Statistics Estonia request failed");
  }
  if (response.status === 429) {
    const delaySeconds = retryAfterSeconds(response.headers.get("retry-after"));
    rateLimitedUntil.set(url, Date.now() + (delaySeconds === null ? DEFAULT_RATE_LIMIT_DELAY_MS : delaySeconds * 1_000));
    await response.body?.cancel().catch(() => undefined);
    throw new StatisticsEstoniaError(
      "rate-limited",
      "Statistics Estonia rate limit reached",
      delaySeconds,
    );
  }
  if (!response.ok) {
    const status = response.status;
    await response.body?.cancel().catch(() => undefined);
    throw new StatisticsEstoniaError("http", `Statistics Estonia returned HTTP ${status}`);
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("json")) {
    await response.body?.cancel().catch(() => undefined);
    throw new StatisticsEstoniaError("content-type", "Statistics Estonia returned an unexpected content type");
  }
  const text = await readBoundedResponseText(response, maximumBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new StatisticsEstoniaError("invalid-json", "Statistics Estonia returned invalid JSON");
  }
}

function normalizedTableId(value: string): string {
  return value.replace(/\.px$/i, "").toUpperCase();
}

const tallinnOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Tallinn",
  timeZoneName: "longOffset",
});

function tallinnOffsetMs(instantMs: number): number {
  const name = tallinnOffsetFormatter.formatToParts(instantMs).find((part) => part.type === "timeZoneName")?.value;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name ?? "");
  if (!match) throw new StatisticsEstoniaError("schema", "Could not resolve Statistics Estonia update timezone");
  const magnitude = (Number(match[2]) * 60 + Number(match[3])) * 60_000;
  return match[1] === "+" ? magnitude : -magnitude;
}

function catalogUpdatedAt(value: string): string | null {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) return null;
  const wallClock = Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6]), Number((match[7] ?? "0").padEnd(3, "0")),
  );
  let instant = wallClock - tallinnOffsetMs(wallClock);
  instant = wallClock - tallinnOffsetMs(instant);
  return new Date(instant).toISOString();
}

function parseCatalog(input: unknown): Record<string, string> {
  if (!Array.isArray(input)) throw new StatisticsEstoniaError("schema", "Statistics Estonia catalog changed");
  const result: Record<string, string> = {};
  for (const row of input) {
    if (typeof row !== "object" || row === null) continue;
    const item = row as Record<string, unknown>;
    if (item.type !== "t" || typeof item.id !== "string" || typeof item.updated !== "string") continue;
    const updatedAt = catalogUpdatedAt(item.updated);
    if (updatedAt) result[normalizedTableId(item.id)] = updatedAt;
  }
  return result;
}

function loadCatalog(url: string, fetchImpl: FetchLike): Promise<Record<string, string>> {
  const cached = catalogCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const promise = requestJson(url, { method: "GET" }, MAX_CATALOG_BYTES, fetchImpl).then(parseCatalog);
  catalogCache.set(url, { expiresAt: Date.now() + CATALOG_CACHE_MS, promise });
  void promise.catch(() => {
    if (catalogCache.get(url)?.promise === promise) catalogCache.delete(url);
  });
  return promise;
}

export async function fetchStatisticsEstoniaTable(
  definition: EconomyTableDefinition,
  fetchImpl: FetchLike = fetch,
): Promise<FetchedEconomyTable> {
  const body = JSON.stringify({ query: definition.query, response: { format: "json-stat2" } });
  const [dataResult, catalogResult] = await Promise.allSettled([
    requestJson(
      definition.apiUrl,
      { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body },
      MAX_DATASET_BYTES,
      fetchImpl,
    ),
    loadCatalog(definition.catalogUrl, fetchImpl),
  ]);
  if (dataResult.status === "rejected") throw dataResult.reason;

  let dataset: ParsedPxDataset;
  try {
    dataset = new ParsedPxDataset(dataResult.value);
    assertPxSchema(dataset, definition.dimensions, definition.requiredLabels);
    if (dataset.source && dataset.source !== "Statistikaamet") throw new TypeError("Unexpected data provider");
    if (dataset.tableId && normalizedTableId(dataset.tableId) !== normalizedTableId(definition.tableId)) {
      throw new TypeError("Unexpected table ID");
    }
  } catch (error) {
    throw new StatisticsEstoniaError(
      "schema",
      error instanceof Error ? error.message : "Statistics Estonia schema changed",
    );
  }

  const catalog = catalogResult.status === "fulfilled" ? catalogResult.value : {};
  const retrievedAt = new Date().toISOString();
  return {
    dataset,
    source: {
      providerId: "statistics-estonia",
      providerName: "Statistikaamet",
      tableId: definition.tableId,
      tableTitle: definition.title,
      tableUrl: definition.tableUrl,
      apiUrl: definition.apiUrl,
      updatedAt: catalog[normalizedTableId(definition.tableId)] ?? dataset.updatedAt,
      retrievedAt,
      attribution: "Statistikaamet",
      licenceName: "CC BY-SA 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      revisionPolicy: "latest-source-value",
    },
  };
}
