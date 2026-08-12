import {
  WeatherParseError,
  aggregateDailyWeather,
  mergeWeatherPoints,
  parseCurrentObservationXml,
  parseOfficialHistoryRows,
  parseOpenMeteoResponse,
  utcMonthRanges,
} from "@/lib/weather-data";
import {
  loadStoredWeatherObservations,
  saveWeatherObservation,
  weatherStoreConfigured,
} from "@/lib/weather-store";
import {
  authenticateWeatherCollector,
  publicWeatherStatus,
  runWeatherCollection,
  weatherCollectorPublicResult,
  type WeatherCollectorOutcome,
} from "@/lib/weather-route-policy";
import type {
  WeatherAttribution,
  WeatherResponse,
  WeatherSourceErrorCode,
  WeatherSourceId,
  WeatherSourceStatus,
} from "@/lib/weather-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

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

const SOURCE_LABELS: Record<WeatherSourceId, string> = {
  environment_agency_current: "Keskkonnaagentuur: Võru hetkevaatlus",
  environment_agency_history: "Keskkonnaagentuur: Võru tunniandmed",
  open_meteo: "Open-Meteo mudel",
};

const ATTRIBUTIONS: WeatherAttribution[] = [
  {
    source: "environment_agency_current",
    label: "Keskkonnaagentuur / Ilmateenistus",
    url: "https://www.ilmateenistus.ee/",
    license: null,
  },
  {
    source: "environment_agency_history",
    label: "Keskkonnaagentuur / Keskkonnaportaal",
    url: "https://keskkonnaportaal.ee/et/avaandmed/keskkonna-ja-ilma-valdkonna-andmeteenused",
    license: null,
  },
  {
    source: "open_meteo",
    label: "Open-Meteo",
    url: "https://open-meteo.com/",
    license: "CC BY 4.0",
  },
];

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

class WeatherRequestError extends Error {
  readonly publicCode: WeatherSourceErrorCode;

  constructor(publicCode: WeatherSourceErrorCode, message: string) {
    super(message);
    this.name = "WeatherRequestError";
    this.publicCode = publicCode;
  }
}

async function responseText(response: Response, maximumBytes: number): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximumBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new WeatherRequestError("invalid_response", "Weather response exceeded its size limit");
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new WeatherRequestError("invalid_response", "Weather response exceeded its size limit");
  }
  return text;
}

async function fetchText(
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
        : { next: { revalidate: options.revalidateSeconds ?? revalidate } }),
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new WeatherRequestError("timeout", "Weather source request timed out");
    }
    throw new WeatherRequestError("unavailable", "Weather source request failed");
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new WeatherRequestError("unavailable", `Weather source returned HTTP ${response.status}`);
  }
  return responseText(response, options.maximumBytes);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WeatherParseError("Weather JSON was invalid");
  }
}

async function loadCurrentObservation(noStore = false) {
  const xml = await fetchText(CURRENT_OBSERVATIONS_URL, {
    accept: "application/xml, text/xml;q=0.9",
    maximumBytes: MAX_XML_BYTES,
    ...(noStore ? { noStore: true } : { revalidateSeconds: 300 }),
  });
  return parseCurrentObservationXml(xml);
}

function officialHistoryUrls(now: Date): string[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = new Date(today - 24 * 60 * 60 * 1_000);
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1_000);

  return utcMonthRanges(start, end).map((range) => {
    const url = new URL(OFFICIAL_HISTORY_BASE_URL);
    url.searchParams.set("jaam_kood", "eq.AJVORU01");
    url.searchParams.set("aasta", `eq.${range.year}`);
    url.searchParams.set("kuu", `eq.${range.month}`);
    url.searchParams.append("paev", `gte.${range.firstDay}`);
    url.searchParams.append("paev", `lte.${range.lastDay}`);
    url.searchParams.set("element_kood", `in.(${HISTORY_ELEMENT_CODES})`);
    url.searchParams.set("select", HISTORY_SELECT_FIELDS);
    url.searchParams.set("order", HISTORY_ORDER);
    return url.toString();
  });
}

async function loadOfficialHistory(now: Date) {
  const bodies = await Promise.all(officialHistoryUrls(now).map((url) => fetchText(url, {
    accept: "application/json",
    maximumBytes: MAX_JSON_BYTES,
    revalidateSeconds: 3_600,
    // The live PostgREST service currently advertises this singular schema
    // name. It supersedes the older plural spelling still shown in some docs.
    headers: { "Accept-Profile": "apijahiala" },
  })));
  const rows = bodies.flatMap((body) => {
    const parsed = parseJson(body);
    if (!Array.isArray(parsed)) throw new WeatherParseError("Official history JSON was invalid");
    return parsed;
  });
  const parsed = parseOfficialHistoryRows(rows);
  if (parsed.points.length === 0) {
    throw new WeatherParseError("Official history contained no Võru measurements");
  }
  return parsed;
}

async function loadOpenMeteo(fetchedAt: Date) {
  const body = await fetchText(OPEN_METEO_URL, {
    accept: "application/json",
    maximumBytes: MAX_JSON_BYTES,
    revalidateSeconds: 900,
  });
  return parseOpenMeteoResponse(parseJson(body), fetchedAt);
}

function sourceErrorCode(error: unknown): WeatherSourceErrorCode {
  if (error instanceof WeatherRequestError) return error.publicCode;
  if (error instanceof WeatherParseError) return "invalid_response";
  return "unavailable";
}

function sourceStatus(
  id: WeatherSourceId,
  kind: WeatherSourceStatus["kind"],
  result: PromiseSettledResult<{ updatedAt: string | null }>,
): WeatherSourceStatus {
  if (result.status === "fulfilled") {
    return {
      id,
      label: SOURCE_LABELS[id],
      kind,
      status: "ok",
      updatedAt: result.value.updatedAt,
    };
  }
  return {
    id,
    label: SOURCE_LABELS[id],
    kind,
    status: "error",
    updatedAt: null,
    errorCode: sourceErrorCode(result.reason),
  };
}

function safeErrorDetails(error: unknown): { name: string; code?: string } {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code: error && typeof error === "object" && "code" in error
      ? String(error.code).slice(0, 40)
      : undefined,
  };
}

function collectorResponse(outcome: WeatherCollectorOutcome, observedAt?: string): Response {
  const result = weatherCollectorPublicResult(outcome, observedAt);
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.status === 401) {
    headers["WWW-Authenticate"] = 'Bearer realm="117.ee weather collector"';
  }
  return Response.json(result.body, { status: result.status, headers });
}

export async function POST(request: Request): Promise<Response> {
  const authorization = authenticateWeatherCollector(
    request.headers.get("authorization"),
    process.env.WEATHER_COLLECTOR_TOKEN,
  );
  if (authorization === "unconfigured") return collectorResponse("collector_not_configured");
  if (authorization === "unauthorized") return collectorResponse("unauthorized");

  const result = await runWeatherCollection({
    storeConfigured: weatherStoreConfigured(),
    loadCurrent: () => loadCurrentObservation(true),
    save: ({ point }) => saveWeatherObservation(point),
  });

  if (result.outcome === "current_observation_unavailable") {
    console.error("Weather collector current observation failed", safeErrorDetails(result.cause));
  } else if (result.outcome === "weather_store_unavailable" && result.cause !== undefined) {
    console.error("Weather collector persistence failed", safeErrorDetails(result.cause));
  }

  return result.outcome === "saved"
    ? collectorResponse("saved", result.value.point.time)
    : collectorResponse(result.outcome);
}

export async function GET(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.has("collect")) {
    return Response.json(
      { ok: false, code: "collector_requires_post" },
      {
        status: 405,
        headers: { Allow: "POST", "Cache-Control": "no-store" },
      },
    );
  }
  const generatedAt = new Date();
  const historyStart = new Date(generatedAt.getTime() - 7 * 24 * 60 * 60 * 1_000);
  const persistenceEnabled = weatherStoreConfigured();
  const [currentResult, historyResult, modelResult, storedResult] = await Promise.allSettled([
    loadCurrentObservation(),
    loadOfficialHistory(generatedAt),
    loadOpenMeteo(generatedAt),
    persistenceEnabled
      ? loadStoredWeatherObservations(historyStart, generatedAt)
      : Promise.resolve([]),
  ]);

  const sources: WeatherSourceStatus[] = [
    sourceStatus("environment_agency_current", "observation", currentResult),
    sourceStatus("environment_agency_history", "observation", historyResult),
    sourceStatus("open_meteo", "model", modelResult),
  ];

  for (const [index, result] of [currentResult, historyResult, modelResult].entries()) {
    if (result.status === "rejected") {
      console.error(`Weather source ${sources[index].id} failed`, result.reason);
    }
  }

  if (storedResult.status === "rejected") {
    console.error("Weather persistence read failed", safeErrorDetails(storedResult.reason));
  }

  const current = currentResult.status === "fulfilled" ? currentResult.value.point : null;
  const archivedObservations = historyResult.status === "fulfilled"
    ? historyResult.value.points
    : [];
  const storedObservations = storedResult.status === "fulfilled"
    ? storedResult.value
    : [];
  const observed = mergeWeatherPoints(
    archivedObservations,
    storedObservations,
    current ? [current] : [],
  );
  const modeled = modelResult.status === "fulfilled"
    ? modelResult.value.modeledHistory
    : [];
  const forecast = modelResult.status === "fulfilled"
    ? modelResult.value.forecast
    : [];

  const payload: WeatherResponse = {
    location: {
      name: "Võru",
      stationName: "Võru",
      stationWmoCode: "26249",
      latitude: 57.8463,
      longitude: 27.0195,
      timezone: "Europe/Tallinn",
    },
    current,
    history: { observed, modeled },
    forecast,
    daily: aggregateDailyWeather([...observed, ...modeled, ...forecast]),
    sources,
    attributions: ATTRIBUTIONS,
    generatedAt: generatedAt.toISOString(),
  };

  const everySourceFailed = sources.every((source) => source.status === "error");
  const status = publicWeatherStatus(everySourceFailed, storedObservations.length);
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": everySourceFailed || status === 502
        ? "no-store"
        : "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
