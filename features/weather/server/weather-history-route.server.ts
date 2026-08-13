import { mergeWeatherPoints } from "@/lib/weather-data";
import {
  aggregateWeatherHistoryForChart,
  createWeatherHistoryCsv,
  validateWeatherHistoryRange,
} from "@/lib/weather-history";
import {
  loadOfficialWeatherHistory,
  safeWeatherErrorDetails,
  weatherSourceErrorCode,
} from "@/lib/weather-source-client.server";
import {
  loadStoredWeatherObservationRange,
  weatherStoreConfigured,
} from "@/lib/weather-store";
import type { WeatherHistoryResponse, WeatherHistorySourceStatus } from "@/lib/weather-types";

function invalidQueryResponse(message: string): Response {
  return Response.json(
    { ok: false, code: "invalid_query", message },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export async function handleWeatherHistoryGet(request: Request): Promise<Response> {
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
    return invalidQueryResponse("unsupported history query parameter");
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
    loadOfficialWeatherHistory(from, to, { allowPartial: true, limit: 20_000 }),
    persistenceEnabled
      ? loadStoredWeatherObservationRange(from, to)
      : Promise.resolve({ points: [], truncated: false }),
  ]);

  if (officialResult.status === "rejected") {
    console.error("Extended official weather history failed", safeWeatherErrorDetails(officialResult.reason));
  }
  if (storedResult.status === "rejected") {
    console.error("Extended stored weather history failed", safeWeatherErrorDetails(storedResult.reason));
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
          label: "Keskkonnaagentuur: Võru tunniandmed",
          status: officialResult.value.partial ? "partial" : "ok",
          updatedAt: officialResult.value.updatedAt,
          pointCount: officialPoints.length,
          ...(officialResult.value.errorCode ? { errorCode: officialResult.value.errorCode } : {}),
        }
      : {
          id: "environment_agency_history",
          label: "Keskkonnaagentuur: Võru tunniandmed",
          status: "error",
          updatedAt: null,
          pointCount: 0,
          errorCode: weatherSourceErrorCode(officialResult.reason),
        },
    !persistenceEnabled
      ? {
          id: "environment_agency_current",
          label: "117.ee talletatud Võru vaatlusandmed",
          status: "not_configured",
          updatedAt: null,
          pointCount: 0,
        }
      : storedResult.status === "fulfilled"
        ? {
            id: "environment_agency_current",
            label: "117.ee talletatud Võru vaatlusandmed",
            status: storedTruncated ? "error" : "ok",
            updatedAt: storedPoints.at(-1)?.time ?? null,
            pointCount: storedPoints.length,
            ...(storedTruncated ? { errorCode: "invalid_response" as const } : {}),
          }
        : {
            id: "environment_agency_current",
            label: "117.ee talletatud Võru vaatlusandmed",
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
    const csv = createWeatherHistoryCsv(merged, { location: "Võru" });
    const filename = `voru-weather-${range.from.slice(0, 10)}-${range.to.slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Weather-History-Partial": String(partial),
        "Cache-Control": "no-store",
      },
    });
  }

  const payload: WeatherHistoryResponse = {
    location: {
      name: "Võru",
      stationName: "Võru",
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
      "Cache-Control": "no-store",
    },
  });
}
