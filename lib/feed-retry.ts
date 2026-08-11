import type { FeedFailure, FeedFailureCode, FeedName } from "./types.ts";

const TIMEOUT_CAUSE_CODES = new Set([
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

const NETWORK_CAUSE_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "UND_ERR_SOCKET",
]);

export class FeedLoadError extends Error {
  readonly code: FeedFailureCode;
  readonly status?: number;

  constructor(code: FeedFailureCode, message: string, status?: number) {
    super(message);
    this.name = "FeedLoadError";
    this.code = code;
    this.status = status;
  }
}

function errorCauseCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("cause" in error)) return null;
  const cause = error.cause;
  if (!cause || typeof cause !== "object" || !("code" in cause) || typeof cause.code !== "string") return null;
  return cause.code;
}

export function normalizeFeedRequestError(error: unknown): FeedLoadError {
  if (error instanceof FeedLoadError) return error;

  const name = error && typeof error === "object" && "name" in error && typeof error.name === "string"
    ? error.name
    : "";
  const causeCode = errorCauseCode(error);
  const message = error instanceof Error ? error.message : "Unexpected feed failure";

  if (name === "AbortError" || name === "TimeoutError" || (causeCode && TIMEOUT_CAUSE_CODES.has(causeCode))) {
    return new FeedLoadError("timeout", message);
  }
  if (error instanceof TypeError || (causeCode && NETWORK_CAUSE_CODES.has(causeCode))) {
    return new FeedLoadError("network", message);
  }
  return new FeedLoadError("unknown", message);
}

export function normalizeFeedLoadError(error: unknown): FeedLoadError {
  if (error instanceof FeedLoadError) return error;
  const message = error instanceof Error ? error.message : "Unexpected feed failure";
  return new FeedLoadError("unknown", message);
}

export function shouldRetryFeedLoad(error: FeedLoadError): boolean {
  if (error.code === "network" || error.code === "timeout") return true;
  return error.code === "http"
    && error.status !== undefined
    && (error.status === 429 || (error.status >= 500 && error.status <= 599));
}

export async function withFeedRetry<T>(operation: () => Promise<T>, maxAttempts = 2): Promise<T> {
  const attempts = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const normalized = normalizeFeedLoadError(error);
      if (attempt === attempts || !shouldRetryFeedLoad(normalized)) throw normalized;
    }
  }

  throw new FeedLoadError("unknown", "Feed retry loop ended unexpectedly");
}

export function publicFeedFailure(name: FeedName, error: unknown): FeedFailure {
  const normalized = normalizeFeedLoadError(error);
  if (normalized.code === "http" && normalized.status !== undefined) {
    return { name, code: "http", status: normalized.status };
  }
  return { name, code: normalized.code === "http" ? "unknown" : normalized.code };
}
