import { createHash, timingSafeEqual } from "node:crypto";

const MIN_COLLECTOR_TOKEN_BYTES = 32;
const MAX_COLLECTOR_TOKEN_BYTES = 512;
const MAX_AUTHORIZATION_HEADER_BYTES = 1_024;

export type WeatherCollectorAuthorization = "authorized" | "unauthorized" | "unconfigured";

export type WeatherCollectorOutcome =
  | "collector_not_configured"
  | "unauthorized"
  | "weather_store_not_configured"
  | "current_observation_unavailable"
  | "weather_store_unavailable"
  | "saved";

export type WeatherCollectorRunResult<T> =
  | { outcome: "weather_store_not_configured" }
  | { outcome: "current_observation_unavailable"; cause: unknown }
  | { outcome: "weather_store_unavailable"; cause?: unknown }
  | { outcome: "saved"; value: T };

export type WeatherCollectorPublicResult = {
  status: 200 | 401 | 502 | 503;
  body:
    | { ok: true; observedAt: string }
    | { ok: false; code: Exclude<WeatherCollectorOutcome, "saved"> };
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

/** Authenticates one fixed-length Bearer digest without ever exposing the token. */
export function authenticateWeatherCollector(
  authorizationHeader: string | null,
  configuredToken: string | undefined,
): WeatherCollectorAuthorization {
  if (!validConfiguredToken(configuredToken)) return "unconfigured";
  const suppliedToken = bearerToken(authorizationHeader);
  if (!suppliedToken) return "unauthorized";
  return timingSafeEqual(tokenDigest(suppliedToken), tokenDigest(configuredToken))
    ? "authorized"
    : "unauthorized";
}

/**
 * Runs collection only after configuration and authentication have been dealt
 * with by the route. Causes stay internal so public responses remain fixed.
 */
export async function runWeatherCollection<T>(options: {
  storeConfigured: boolean;
  loadCurrent: () => Promise<T>;
  save: (value: T) => Promise<boolean>;
}): Promise<WeatherCollectorRunResult<T>> {
  if (!options.storeConfigured) return { outcome: "weather_store_not_configured" };

  let value: T;
  try {
    value = await options.loadCurrent();
  } catch (cause) {
    return { outcome: "current_observation_unavailable", cause };
  }

  try {
    const saved = await options.save(value);
    return saved
      ? { outcome: "saved", value }
      : { outcome: "weather_store_unavailable" };
  } catch (cause) {
    return { outcome: "weather_store_unavailable", cause };
  }
}

/** Converts internal outcomes into small, fixed, secret-free HTTP payloads. */
export function weatherCollectorPublicResult(
  outcome: WeatherCollectorOutcome,
  observedAt?: string,
): WeatherCollectorPublicResult {
  if (outcome === "saved") {
    return { status: 200, body: { ok: true, observedAt: observedAt ?? "" } };
  }
  const statuses: Record<Exclude<WeatherCollectorOutcome, "saved">, 401 | 502 | 503> = {
    collector_not_configured: 503,
    unauthorized: 401,
    weather_store_not_configured: 503,
    current_observation_unavailable: 502,
    weather_store_unavailable: 503,
  };
  return { status: statuses[outcome], body: { ok: false, code: outcome } };
}

/** Stored observations keep the weather response useful during a full upstream outage. */
export function publicWeatherStatus(
  everyExternalSourceFailed: boolean,
  storedObservationCount: number,
): 200 | 502 {
  return everyExternalSourceFailed && storedObservationCount <= 0 ? 502 : 200;
}
