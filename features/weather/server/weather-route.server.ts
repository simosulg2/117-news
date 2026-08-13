import { aggregateDailyWeather, mergeWeatherPoints } from "@/lib/weather-data";
import {
  loadCurrentWeatherObservation,
  loadOfficialWeatherHistory,
  loadOpenMeteoWeather,
  safeWeatherErrorDetails,
  weatherSourceErrorCode,
} from "@/lib/weather-source-client.server";
import {
  authenticateWeatherCollector,
  publicWeatherStatus,
  runWeatherCollection,
  weatherCollectorPublicResult,
  type WeatherCollectorOutcome,
} from "@/lib/weather-route-policy";
import {
  loadStoredWeatherObservations,
  saveWeatherObservation,
  weatherStoreConfigured,
} from "@/lib/weather-store";
import type {
  WeatherAttribution,
  WeatherResponse,
  WeatherSourceId,
  WeatherSourceStatus,
} from "@/lib/weather-types";

const DAY_MS = 24 * 60 * 60 * 1_000;
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

async function loadRecentOfficialHistory(now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = new Date(today - DAY_MS);
  const start = new Date(end.getTime() - 6 * DAY_MS);
  return loadOfficialWeatherHistory(start, new Date(end.getTime() + DAY_MS));
}

function sourceStatus(
  id: WeatherSourceId,
  kind: WeatherSourceStatus["kind"],
  result: PromiseSettledResult<{ updatedAt: string | null }>,
): WeatherSourceStatus {
  return result.status === "fulfilled"
    ? {
        id,
        label: SOURCE_LABELS[id],
        kind,
        status: "ok",
        updatedAt: result.value.updatedAt,
      }
    : {
        id,
        label: SOURCE_LABELS[id],
        kind,
        status: "error",
        updatedAt: null,
        errorCode: weatherSourceErrorCode(result.reason),
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

export async function handleWeatherPost(request: Request): Promise<Response> {
  const authorization = authenticateWeatherCollector(
    request.headers.get("authorization"),
    process.env.WEATHER_COLLECTOR_TOKEN,
  );
  if (authorization === "unconfigured") return collectorResponse("collector_not_configured");
  if (authorization === "unauthorized") return collectorResponse("unauthorized");

  const result = await runWeatherCollection({
    storeConfigured: weatherStoreConfigured(),
    loadCurrent: () => loadCurrentWeatherObservation(true),
    save: ({ point }) => saveWeatherObservation(point),
  });

  if (result.outcome === "current_observation_unavailable") {
    console.error("Weather collector current observation failed", safeWeatherErrorDetails(result.cause));
  } else if (result.outcome === "weather_store_unavailable" && result.cause !== undefined) {
    console.error("Weather collector persistence failed", safeWeatherErrorDetails(result.cause));
  }

  return result.outcome === "saved"
    ? collectorResponse("saved", result.value.point.time)
    : collectorResponse(result.outcome);
}

export async function handleWeatherGet(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.has("collect")) {
    return Response.json(
      { ok: false, code: "collector_requires_post" },
      { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
    );
  }

  const generatedAt = new Date();
  const historyStart = new Date(generatedAt.getTime() - 7 * DAY_MS);
  const persistenceEnabled = weatherStoreConfigured();
  const [currentResult, historyResult, modelResult, storedResult] = await Promise.allSettled([
    loadCurrentWeatherObservation(),
    loadRecentOfficialHistory(generatedAt),
    loadOpenMeteoWeather(generatedAt),
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
      console.error(`Weather source ${sources[index].id} failed`, safeWeatherErrorDetails(result.reason));
    }
  }
  if (storedResult.status === "rejected") {
    console.error("Weather persistence read failed", safeWeatherErrorDetails(storedResult.reason));
  }

  const current = currentResult.status === "fulfilled" ? currentResult.value.point : null;
  const archivedObservations = historyResult.status === "fulfilled" ? historyResult.value.points : [];
  const storedObservations = storedResult.status === "fulfilled" ? storedResult.value : [];
  const observed = mergeWeatherPoints(
    archivedObservations,
    storedObservations,
    current ? [current] : [],
  );
  const modeled = modelResult.status === "fulfilled" ? modelResult.value.modeledHistory : [];
  const forecast = modelResult.status === "fulfilled" ? modelResult.value.forecast : [];
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
