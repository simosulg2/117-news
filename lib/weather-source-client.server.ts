import {
  WeatherParseError,
  parseCurrentObservationXml,
  parseOfficialHistoryRows,
  parseOpenMeteoResponse,
  utcMonthRanges,
} from "./weather-data.ts";
import type { WeatherPoint, WeatherSourceErrorCode } from "./weather-types.ts";
import { readBoundedResponseText, ResponseSizeLimitError } from "./bounded-response.ts";

const CURRENT_OBSERVATIONS_URL =
  "https://www.ilmateenistus.ee/ilma_andmed/xml/observations.php";
const OFFICIAL_HISTORY_BASE_URL = "https://keskkonnaandmed.envir.ee/f_kliima_tund";
const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast"
  + "?latitude=57.8463"
  + "&longitude=27.0195"
  + "&hourly=temperature_2m%2Capparent_temperature%2Crelative_humidity_2m%2Ccloud_cover%2Cprecipitation%2Cpressure_msl%2Cwind_speed_10m%2Cwind_gusts_10m%2Cwind_direction_10m%2Cweather_code"
  + "&past_days=7"
  + "&forecast_days=7"
  + "&timezone=UTC"
  + "&wind_speed_unit=ms";

const HISTORY_ELEMENT_CODES = "PA0,PR1H,RH,TA,WD10M,WS10M,WSX1H";
const HISTORY_SELECT_FIELDS = [
  "aasta",
  "kuu",
  "paev",
  "tund",
  "vaartus",
  "element_kood",
  "avaandmed_ts",
].join(",");
const HISTORY_ORDER = "aasta.asc,kuu.asc,paev.asc,tund.asc,element_kood.asc";
const MAX_XML_BYTES = 1_000_000;
const MAX_JSON_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 10_000;

export class WeatherSourceRequestError extends Error {
  readonly publicCode: WeatherSourceErrorCode;

  constructor(publicCode: WeatherSourceErrorCode, message: string) {
    super(message);
    this.name = "WeatherSourceRequestError";
    this.publicCode = publicCode;
  }
}

async function fetchWeatherText(
  url: string,
  options: {
    accept: string;
    maximumBytes: number;
    revalidateSeconds?: number;
    noStore?: boolean;
    headers?: Record<string, string>;
  },
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: options.accept,
        "User-Agent": "117.ee weather (+https://117.ee)",
        ...options.headers,
      },
      ...(options.noStore
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidateSeconds ?? 300 } }),
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new WeatherSourceRequestError("timeout", "Weather source request timed out");
    }
    throw new WeatherSourceRequestError("unavailable", "Weather source request failed");
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new WeatherSourceRequestError(
      "unavailable",
      `Weather source returned HTTP ${response.status}`,
    );
  }
  try {
    return await readBoundedResponseText(response, options.maximumBytes);
  } catch (error) {
    if (error instanceof ResponseSizeLimitError) {
      throw new WeatherSourceRequestError(
        "invalid_response",
        "Weather response exceeded its size limit",
      );
    }
    throw error;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WeatherParseError("Weather JSON was invalid");
  }
}

function officialHistoryUrls(from: Date, to: Date, limit?: number): string[] {
  return utcMonthRanges(from, new Date(to.getTime() - 1)).map((month) => {
    const url = new URL(OFFICIAL_HISTORY_BASE_URL);
    url.searchParams.set("jaam_kood", "eq.AJVORU01");
    url.searchParams.set("aasta", `eq.${month.year}`);
    url.searchParams.set("kuu", `eq.${month.month}`);
    url.searchParams.append("paev", `gte.${month.firstDay}`);
    url.searchParams.append("paev", `lte.${month.lastDay}`);
    url.searchParams.set("element_kood", `in.(${HISTORY_ELEMENT_CODES})`);
    url.searchParams.set("select", HISTORY_SELECT_FIELDS);
    url.searchParams.set("order", HISTORY_ORDER);
    if (limit !== undefined) url.searchParams.set("limit", String(limit));
    return url.toString();
  });
}

async function loadOfficialHistoryMonth(url: string, noStore: boolean) {
  const body = await fetchWeatherText(url, {
    accept: "application/json",
    maximumBytes: MAX_JSON_BYTES,
    ...(noStore ? { noStore: true } : { revalidateSeconds: 3_600 }),
    headers: { "Accept-Profile": "apijahiala" },
  });
  const rows = parseJson(body);
  if (!Array.isArray(rows)) throw new WeatherParseError("Official history JSON was invalid");
  return parseOfficialHistoryRows(rows);
}

function combineOfficialHistory(
  fulfilled: Awaited<ReturnType<typeof loadOfficialHistoryMonth>>[],
  from: Date,
  to: Date,
) {
  const points = fulfilled.flatMap((result) => result.points).filter((point) => {
    const time = Date.parse(point.time);
    return time >= from.getTime() && time < to.getTime();
  });
  const updatedTimes = fulfilled
    .map((result) => result.updatedAt === null ? Number.NaN : Date.parse(result.updatedAt))
    .filter(Number.isFinite);
  return {
    points,
    updatedAt: updatedTimes.length > 0
      ? new Date(Math.max(...updatedTimes)).toISOString()
      : null,
  };
}

export async function loadCurrentWeatherObservation(noStore = false) {
  const xml = await fetchWeatherText(CURRENT_OBSERVATIONS_URL, {
    accept: "application/xml, text/xml;q=0.9",
    maximumBytes: MAX_XML_BYTES,
    ...(noStore ? { noStore: true } : { revalidateSeconds: 300 }),
  });
  return parseCurrentObservationXml(xml);
}

export async function loadOpenMeteoWeather(fetchedAt: Date, noStore = false) {
  const body = await fetchWeatherText(OPEN_METEO_URL, {
    accept: "application/json",
    maximumBytes: MAX_JSON_BYTES,
    ...(noStore ? { noStore: true } : { revalidateSeconds: 900 }),
  });
  return parseOpenMeteoResponse(parseJson(body), fetchedAt);
}

export type OfficialWeatherHistory = {
  points: WeatherPoint[];
  updatedAt: string | null;
  partial: boolean;
  errorCode?: WeatherSourceErrorCode;
};

export async function loadOfficialWeatherHistory(
  from: Date,
  to: Date,
  options: { allowPartial?: boolean; limit?: number; noStore?: boolean } = {},
): Promise<OfficialWeatherHistory> {
  const loaders = officialHistoryUrls(from, to, options.limit)
    .map((url) => loadOfficialHistoryMonth(url, options.noStore === true));
  if (!options.allowPartial) {
    const combined = combineOfficialHistory(await Promise.all(loaders), from, to);
    if (combined.points.length === 0) {
      throw new WeatherParseError("Official history contained no Võru measurements");
    }
    return { ...combined, partial: false };
  }

  const results = await Promise.allSettled(loaders);
  const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (fulfilled.length === 0) {
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw rejected?.reason ?? new WeatherParseError("Official history contained no month ranges");
  }

  const combined = combineOfficialHistory(fulfilled, from, to);
  const firstFailure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  return {
    ...combined,
    partial: fulfilled.length !== results.length,
    ...(firstFailure ? { errorCode: weatherSourceErrorCode(firstFailure.reason) } : {}),
  };
}

export function weatherSourceErrorCode(error: unknown): WeatherSourceErrorCode {
  if (error instanceof WeatherSourceRequestError) return error.publicCode;
  if (error instanceof WeatherParseError) return "invalid_response";
  return "unavailable";
}

export function safeWeatherErrorDetails(error: unknown): { name: string; code?: string } {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code: error && typeof error === "object" && "code" in error
      ? String(error.code).slice(0, 40)
      : undefined,
  };
}
