import { createHash, timingSafeEqual } from "node:crypto";

const MIN_COLLECTOR_TOKEN_BYTES = 32;
const MAX_COLLECTOR_TOKEN_BYTES = 512;
const MAX_AUTHORIZATION_HEADER_BYTES = 1_024;
const MAX_PUBLIC_COUNT = 10_000;

export type NewsCollectorAuthorization = "authorized" | "unauthorized" | "unconfigured";

export type NewsCollectorOutcome =
  | "collector_not_configured"
  | "unauthorized"
  | "news_store_not_configured"
  | "no_sources_available"
  | "news_store_unavailable"
  | "saved";

export type NewsCollectorSummary = {
  collectedAt: string;
  storedArticles: number;
  affectedStories: number;
  sourcesLoaded: number;
  sourcesTotal: number;
};

export type NewsCollectorPublicResult = {
  status: 200 | 401 | 502 | 503;
  body:
    | {
        ok: true;
        collectedAt: string;
        storedArticles: number;
        affectedStories: number;
        sources: { loaded: number; total: number; partial: boolean };
      }
    | { ok: false; code: Exclude<NewsCollectorOutcome, "saved"> };
};

function tokenByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function validConfiguredToken(value: string | undefined): value is string {
  if (typeof value !== "string" || /\s/u.test(value)) return false;
  const byteLength = tokenByteLength(value);
  return byteLength >= MIN_COLLECTOR_TOKEN_BYTES && byteLength <= MAX_COLLECTOR_TOKEN_BYTES;
}

function bearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader || tokenByteLength(authorizationHeader) > MAX_AUTHORIZATION_HEADER_BYTES) {
    return null;
  }
  const match = /^Bearer ([^\s]+)$/iu.exec(authorizationHeader);
  if (!match) return null;
  const byteLength = tokenByteLength(match[1]);
  return byteLength > 0 && byteLength <= MAX_COLLECTOR_TOKEN_BYTES ? match[1] : null;
}

function tokenDigest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Authenticates one fixed-length digest without retaining or exposing tokens. */
export function authenticateNewsCollector(
  authorizationHeader: string | null,
  configuredToken: string | undefined,
): NewsCollectorAuthorization {
  if (!validConfiguredToken(configuredToken)) return "unconfigured";
  const suppliedToken = bearerToken(authorizationHeader);
  if (!suppliedToken) return "unauthorized";
  return timingSafeEqual(tokenDigest(suppliedToken), tokenDigest(configuredToken))
    ? "authorized"
    : "unauthorized";
}

function publicCount(value: number): number {
  return Number.isFinite(value)
    ? Math.min(MAX_PUBLIC_COUNT, Math.max(0, Math.trunc(value)))
    : 0;
}

function publicTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

/** Converts internal outcomes into small, fixed, secret-free HTTP payloads. */
export function newsCollectorPublicResult(
  outcome: NewsCollectorOutcome,
  summary?: NewsCollectorSummary,
): NewsCollectorPublicResult {
  if (outcome === "saved") {
    const loaded = publicCount(summary?.sourcesLoaded ?? 0);
    const total = Math.max(loaded, publicCount(summary?.sourcesTotal ?? 0));
    return {
      status: 200,
      body: {
        ok: true,
        collectedAt: publicTimestamp(summary?.collectedAt ?? ""),
        storedArticles: publicCount(summary?.storedArticles ?? 0),
        affectedStories: publicCount(summary?.affectedStories ?? 0),
        sources: { loaded, total, partial: loaded < total },
      },
    };
  }

  const statuses: Record<Exclude<NewsCollectorOutcome, "saved">, 401 | 502 | 503> = {
    collector_not_configured: 503,
    unauthorized: 401,
    news_store_not_configured: 503,
    no_sources_available: 502,
    news_store_unavailable: 503,
  };
  return { status: statuses[outcome], body: { ok: false, code: outcome } };
}
