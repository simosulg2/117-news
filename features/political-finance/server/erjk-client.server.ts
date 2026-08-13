import { readBoundedResponseText } from "../../../lib/bounded-response.ts";
import { ERJK_API_ORIGIN, ERJK_ORIGIN } from "./erjk-config.ts";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 3_000_000;

export class ErjkRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErjkRequestError";
  }
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Releasing an unusable response is best-effort.
  }
}

export async function fetchErjkJson(path: string): Promise<unknown> {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ErjkRequestError("Invalid ERJK API path");
  }
  const url = new URL(`/et/api${path}`, ERJK_ORIGIN);
  if (url.origin !== ERJK_ORIGIN_FROM_API || !url.pathname.startsWith("/et/api/")) {
    throw new ErjkRequestError("ERJK API path left the approved origin");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "117.ee political finance dashboard (+https://117.ee)",
      },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new ErjkRequestError("ERJK request timed out");
    }
    throw new ErjkRequestError("ERJK request failed");
  }

  if (!response.ok) {
    const status = response.status;
    await discardBody(response);
    throw new ErjkRequestError(`ERJK returned HTTP ${status}`);
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("json")) {
    await discardBody(response);
    throw new ErjkRequestError("ERJK returned an unexpected content type");
  }

  const text = await readBoundedResponseText(response, MAX_RESPONSE_BYTES);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ErjkRequestError("ERJK returned invalid JSON");
  }
}

const ERJK_ORIGIN_FROM_API = new URL(ERJK_API_ORIGIN).origin;
