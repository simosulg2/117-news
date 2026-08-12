import {
  WeatherParseError,
  mergeWeatherPoints,
  parseOfficialHistoryRows,
  utcMonthRanges,
} from "@/lib/weather-data";
import {
  aggregateWeatherHistoryForChart,
  createWeatherHistoryCsv,
  validateWeatherHistoryRange,
} from "@/lib/weather-history";
import {
  loadStoredWeatherObservationRange,
  weatherStoreConfigured,
} from "@/lib/weather-store";
import type {
  WeatherHistoryResponse,
  WeatherHistorySourceStatus,
  WeatherSourceErrorCode,
} from "@/lib/weather-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

const OFFICIAL_HISTORY_BASE_URL = "https://keskkonnaandmed.envir.ee/f_kliima_tund";
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
const MAX_JSON_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 10_000;

class HistoryRequestError extends Error {
  readonly publicCode: WeatherSourceErrorCode;

  constructor(publicCode: WeatherSourceErrorCode, message: string) {
    super(message);
    this.name = "HistoryRequestError";
    this.publicCode = publicCode;
  }
}

function sourceErrorCode(error: unknown): WeatherSourceErrorCode {
  if (error instanceof HistoryRequestError) return error.publicCode;
  if (error instanceof WeatherParseError) return "invalid_response";
  return "unavailable";
}

async function responseText(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_JSON_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new HistoryRequestError("invalid_response", "Weather history response exceeded its size limit");
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
    throw new HistoryRequestError("invalid_response", "Weather history response exceeded its size limit");
  }
  return text;
}

async function fetchOfficialHistoryBody(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Profile": "apijahiala",
        "User-Agent": "117.ee weather (+https://117.ee)",
      },
      next: { revalidate: 3_600 },
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new HistoryRequestError("timeout", "Weather history request timed out");
    }
    throw new HistoryRequestError("unavailable", "Weather history request failed");
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new HistoryRequestError("unavailable", `Weather history source returned HTTP ${response.status}`);
  }
  return responseText(response);
}

function officialHistoryUrls(from: Date, to: Date): string[] {
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
    url.searchParams.set("limit", "20000");
    return url.toString();
  });
}

async function loadOfficialHistoryMonth(url: string) {
  const body = await fetchOfficialHistoryBody(url);
  let rows: unknown;
  try {
    rows = JSON.parse(body) as unknown;
  } catch {
    throw new WeatherParseError("Official history JSON was invalid");
  }
  if (!Array.isArray(rows)) throw new WeatherParseError("Official history JSON was invalid");
  return parseOfficialHistoryRows(rows);
}

async function loadOfficialHistory(from: Date, to: Date) {
  const results = await Promise.allSettled(
    officialHistoryUrls(from, to).map(loadOfficialHistoryMonth),
  );
  const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (fulfilled.length === 0) {
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    throw rejected?.reason ?? new WeatherParseError("Official history contained no month ranges");
  }

  const points = fulfilled.flatMap((result) => result.points).filter((point) => {
    const time = Date.parse(point.time);
    return time >= from.getTime() && time < to.getTime();
  });
  const updatedTimes = fulfilled
    .map((result) => result.updatedAt === null ? Number.NaN : Date.parse(result.updatedAt))
    .filter(Number.isFinite);
  const firstFailure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  return {
    points,
    updatedAt: updatedTimes.length > 0
      ? new Date(Math.max(...updatedTimes)).toISOString()
      : null,
    partial: fulfilled.length !== results.length,
    errorCode: firstFailure ? sourceErrorCode(firstFailure.reason) : undefined,
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

export async function GET(request: Request): Promise<Response> {
  const generatedAt = new Date();
  const search = new URL(request.url).searchParams;
  const allowedParameters = new Set(["from", "to", "format"]);
  const hasDuplicateParameters = search.getAll("from").length !== 1
    || search.getAll("to").length !== 1
    || search.getAll("format").length > 1;
  if (
    hasDuplicateParameters
    || [...search.keys()].some((key) => !allowedParameters.has(key))
    || (search.has("format") && search.get("format") !== "csv")
  ) {
    return Response.json(
      { ok: false, code: "invalid_query", message: "unsupported history query parameter" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const validated = validateWeatherHistoryRange(search.get("from"), search.get("to"), {
    now: generatedAt,
  });
  if (!validated.ok) {
    return Response.json(
      { ok: false, code: validated.error.code, message: validated.error.message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { range } = validated;
  const from = new Date(range.fromMs);
  const to = new Date(range.toMs);
  const persistenceEnabled = weatherStoreConfigured();
  const [officialResult, storedResult] = await Promise.allSettled([
    loadOfficialHistory(from, to),
    persistenceEnabled
      ? loadStoredWeatherObservationRange(from, to)
      : Promise.resolve({ points: [], truncated: false }),
  ]);

  if (officialResult.status === "rejected") {
    console.error("Extended official weather history failed", safeErrorDetails(officialResult.reason));
  }
  if (storedResult.status === "rejected") {
    console.error("Extended stored weather history failed", safeErrorDetails(storedResult.reason));
  }

  const officialPoints = officialResult.status === "fulfilled" ? officialResult.value.points : [];
  const storedPoints = storedResult.status === "fulfilled" ? storedResult.value.points : [];
  const storedTruncated = storedResult.status === "fulfilled" && storedResult.value.truncated;
  const merged = mergeWeatherPoints(officialPoints, storedPoints);
  const chart = aggregateWeatherHistoryForChart(merged, range);

  const sources: WeatherHistorySourceStatus[] = [
    officialResult.status === "fulfilled"
      ? {
          id: "environment_agency_history",
          label: "Keskkonnaagentuur: V\u00f5ru tunniandmed",
          status: officialResult.value.partial ? "partial" : "ok",
          updatedAt: officialResult.value.updatedAt,
          pointCount: officialPoints.length,
          ...(officialResult.value.errorCode ? { errorCode: officialResult.value.errorCode } : {}),
        }
      : {
          id: "environment_agency_history",
          label: "Keskkonnaagentuur: V\u00f5ru tunniandmed",
          status: "error",
          updatedAt: null,
          pointCount: 0,
          errorCode: sourceErrorCode(officialResult.reason),
        },
    !persistenceEnabled
      ? {
          id: "environment_agency_current",
          label: "117.ee talletatud V\u00f5ru vaatlusandmed",
          status: "not_configured",
          updatedAt: null,
          pointCount: 0,
        }
      : storedResult.status === "fulfilled"
        ? {
            id: "environment_agency_current",
            label: "117.ee talletatud V\u00f5ru vaatlusandmed",
            status: storedTruncated ? "error" : "ok",
            updatedAt: storedPoints.at(-1)?.time ?? null,
            pointCount: storedPoints.length,
            ...(storedTruncated ? { errorCode: "invalid_response" as const } : {}),
          }
        : {
            id: "environment_agency_current",
            label: "117.ee talletatud V\u00f5ru vaatlusandmed",
            status: "error",
            updatedAt: null,
            pointCount: 0,
            errorCode: "unavailable",
          },
  ];

  const partial = officialResult.status === "rejected"
    || officialResult.value.partial
    || storedResult.status === "rejected"
    || storedTruncated;

  if (search.get("format") === "csv") {
    const csv = createWeatherHistoryCsv(merged, { location: "V\u00f5ru" });
    const filename = `voru-weather-${range.from.slice(0, 10)}-${range.to.slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Weather-History-Partial": String(partial),
        "Cache-Control": partial
          ? "no-store"
          : "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  }

  const payload: WeatherHistoryResponse = {
    location: {
      name: "V\u00f5ru",
      stationName: "V\u00f5ru",
      stationWmoCode: "26249",
      latitude: 57.8463,
      longitude: 27.0195,
      timezone: "Europe/Tallinn",
    },
    range: {
      from: range.from,
      to: range.to,
      durationHours: range.durationMs / (60 * 60 * 1_000),
    },
    points: chart.points,
    resolution: chart.resolution,
    coverage: chart.coverage,
    sources,
    partial,
    generatedAt: generatedAt.toISOString(),
  };

  const status = merged.length > 0 || officialResult.status === "fulfilled" ? 200 : 502;
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": status === 200 && !partial
        ? "public, s-maxage=300, stale-while-revalidate=900"
        : "no-store",
    },
  });
}
