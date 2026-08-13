import { parseNorstatRatings } from "./norstat-parser";
import { NORSTAT_RATINGS_DATA_URL } from "./norstat-source";
import {
  ratingsContentTypeMayContainJson,
  readBoundedResponseText,
} from "@/lib/ratings-response";
import { InProcessSnapshotCache } from "@/lib/snapshot-cache";
import type { RatingsResponse, RatingsUnavailableResponse } from "@/lib/ratings-types";

const RATINGS_SNAPSHOT_TTL_MS = 60 * 60 * 1_000;
const RATINGS_STALE_RETRY_DELAY_MS = 5 * 60 * 1_000;
const RATINGS_REQUEST_TIMEOUT_MS = 15_000;
const MAX_RATINGS_JSON_BYTES = 5_000_000;

const ratingsSnapshotCache = new InProcessSnapshotCache<RatingsResponse>(
  RATINGS_SNAPSHOT_TTL_MS,
  RATINGS_STALE_RETRY_DELAY_MS,
);

class RatingsRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatingsRequestError";
  }
}

async function discardBody(response: Response): Promise<void> {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
    // Cancellation is only a best-effort way to release the connection.
  }
}

function normalizedHttpDate(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function safeErrorDetails(error: unknown): { name: string; code?: string } {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code: error && typeof error === "object" && "code" in error
      ? String(error.code).slice(0, 40)
      : undefined,
  };
}

async function refreshRatingsSnapshot(): Promise<RatingsResponse> {
  let response: Response;
  try {
    response = await fetch(NORSTAT_RATINGS_DATA_URL, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "117.ee ratings tracker (+https://117.ee)",
      },
      redirect: "error",
      signal: AbortSignal.timeout(RATINGS_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new RatingsRequestError("Ratings source request timed out");
    }
    throw new RatingsRequestError("Ratings source request failed");
  }

  if (!response.ok) {
    const status = response.status;
    await discardBody(response);
    throw new RatingsRequestError(`Ratings source returned HTTP ${status}`);
  }

  if (!ratingsContentTypeMayContainJson(response.headers.get("content-type"))) {
    await discardBody(response);
    throw new RatingsRequestError("Ratings source returned an unexpected content type");
  }

  const sourceUpdatedAt = normalizedHttpDate(response.headers.get("last-modified"));
  const body = await readBoundedResponseText(response, MAX_RATINGS_JSON_BYTES);
  let input: unknown;
  try {
    input = JSON.parse(body) as unknown;
  } catch {
    throw new RatingsRequestError("Ratings source returned invalid JSON");
  }

  return {
    poll: parseNorstatRatings(input),
    fetchedAt: new Date().toISOString(),
    sourceUpdatedAt,
  };
}

export function getRatingsSnapshot() {
  return ratingsSnapshotCache.get(refreshRatingsSnapshot);
}

export async function handleRatingsGet(): Promise<Response> {
  try {
    const snapshot = await getRatingsSnapshot();
    return Response.json(snapshot.value, {
      headers: {
        "Cache-Control": "no-store",
        "X-Ratings-Snapshot": snapshot.status,
      },
    });
  } catch (error) {
    console.error("Failed to refresh ratings snapshot", safeErrorDetails(error));
    const body: RatingsUnavailableResponse = {
      error: "Reitingute laadimine ebaõnnestus. Palun proovi mõne hetke pärast uuesti.",
    };
    return Response.json(body, {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "X-Ratings-Snapshot": "unavailable",
      },
    });
  }
}
