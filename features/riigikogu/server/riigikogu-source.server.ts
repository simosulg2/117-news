import { readBoundedResponseText } from "../../../lib/bounded-response.ts";

const API_ORIGIN = "https://api.riigikogu.ee";
const REQUEST_TIMEOUT_MS = 12_000;
const MAXIMUM_JSON_BYTES = 4_000_000;
const MINIMUM_REQUEST_INTERVAL_MS = 1_050;
const PATH_WINDOW_MS = 60_000;
const MAXIMUM_REQUESTS_PER_PATH = 12;

type Pause = (milliseconds: number) => Promise<void>;

export class RiigikoguRequestScheduler {
  private tail: Promise<void> = Promise.resolve();
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  private readonly pathRequests = new Map<string, number[]>();
  private readonly now: () => number;
  private readonly pause: Pause;

  constructor(
    now: () => number = Date.now,
    pause: Pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.now = now;
    this.pause = pause;
  }

  schedule<T>(path: string, operation: () => Promise<T>): Promise<T> {
    const run = async () => {
      const current = this.now();
      const recent = (this.pathRequests.get(path) ?? []).filter((time) => current - time < PATH_WINDOW_MS);
      const globalWait = Math.max(0, MINIMUM_REQUEST_INTERVAL_MS - (current - this.lastRequestAt));
      const pathWait = recent.length >= MAXIMUM_REQUESTS_PER_PATH
        ? Math.max(0, PATH_WINDOW_MS - (current - recent[0]))
        : 0;
      const wait = Math.max(globalWait, pathWait);
      if (wait > 0) await this.pause(wait);
      const startedAt = this.now();
      const updated = recent.filter((time) => startedAt - time < PATH_WINDOW_MS);
      updated.push(startedAt);
      this.pathRequests.set(path, updated);
      this.lastRequestAt = startedAt;
      return operation();
    };
    const result = this.tail.then(run, run);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

const scheduler = new RiigikoguRequestScheduler();

class RiigikoguSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiigikoguSourceError";
  }
}

function safeUrl(path: string, parameters: Readonly<Record<string, string>>): URL {
  if (!path.startsWith("/api/") || path.includes("..")) throw new RiigikoguSourceError("Invalid source path");
  const url = new URL(path, API_ORIGIN);
  if (url.origin !== API_ORIGIN) throw new RiigikoguSourceError("Invalid source origin");
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
  return url;
}

async function discardBody(response: Response): Promise<void> {
  try { await response.body?.cancel(); } catch { /* best effort */ }
}

export async function fetchRiigikoguJson(
  path: string,
  parameters: Readonly<Record<string, string>> = {},
): Promise<{ value: unknown; retrievedAt: string }> {
  const url = safeUrl(path, parameters);
  return scheduler.schedule(url.pathname, async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        // The deployment data cache reduces cold-instance fan-out. The
        // scheduler still enforces the published limit inside each process.
        cache: "force-cache",
        next: { revalidate: 60 },
        headers: {
          Accept: "application/json",
          "User-Agent": "117.ee Riigikogu terminal (+https://117.ee)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new RiigikoguSourceError("Riigikogu source request failed");
    }
    if (!response.ok) {
      const status = response.status;
      await discardBody(response);
      throw new RiigikoguSourceError(`Riigikogu source returned HTTP ${status}`);
    }
    const type = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!type.includes("application/json") && !type.includes("+json")) {
      await discardBody(response);
      throw new RiigikoguSourceError("Riigikogu source returned an unexpected content type");
    }
    const text = await readBoundedResponseText(response, MAXIMUM_JSON_BYTES);
    try {
      return { value: JSON.parse(text) as unknown, retrievedAt: new Date().toISOString() };
    } catch {
      throw new RiigikoguSourceError("Riigikogu source returned invalid JSON");
    }
  });
}

export function safeRiigikoguError(error: unknown): { name: string } {
  return { name: error instanceof Error ? error.name : "UnknownError" };
}
