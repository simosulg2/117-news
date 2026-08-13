import { loadEconomyResponse } from "../../economy/server/economy-route.server.ts";
import { getNewsSnapshot } from "../../news/server/news-service.server.ts";
import { getPoliticalFinanceOverview } from "../../political-finance/server/political-finance-overview.server.ts";
import { getRatingsSnapshot } from "../../ratings/server/ratings-route.server.ts";
import { loadRiigikoguOverview } from "../../riigikogu/server/riigikogu-overview.server.ts";
import { loadRiigikoguVote } from "../../riigikogu/server/riigikogu-detail.server.ts";
import { getWeatherSnapshot } from "../../weather/server/weather-route.server.ts";
import { getWeatherWarningsSnapshot } from "../../weather/server/weather-warning.server.ts";
import type { NowResponse, NowSourceStatus } from "../../../lib/now-types.ts";
import type { SnapshotCacheResult } from "../../../lib/snapshot-cache.ts";
import { buildNowCards } from "../model/build-now.ts";

function snapshotStatus<T>(result: PromiseSettledResult<SnapshotCacheResult<T>>): NowSourceStatus {
  if (result.status === "rejected") return "unavailable";
  return result.value.status === "stale-if-error" ? "stale" : "ok";
}

function combineStatuses(left: NowSourceStatus, right: NowSourceStatus): NowSourceStatus {
  if (left === "unavailable" && right === "unavailable") return "unavailable";
  if (left === "stale" || right === "stale") return "stale";
  if (left !== "ok" || right !== "ok") return "partial";
  return "ok";
}

export async function buildNowResponse(): Promise<NowResponse> {
  const [news, weather, ratings, warnings, riigikogu, economy, finance] = await Promise.allSettled([
    getNewsSnapshot(), getWeatherSnapshot(), getRatingsSnapshot(), getWeatherWarningsSnapshot(),
    loadRiigikoguOverview(), loadEconomyResponse(), getPoliticalFinanceOverview(),
  ]);
  const newestVote = riigikogu.status === "fulfilled"
    ? [...riigikogu.value.votes].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))[0]
    : undefined;
  const riigikoguVote = newestVote ? await loadRiigikoguVote(newestVote.id).catch(() => undefined) : undefined;
  const baseNewsStatus = snapshotStatus(news);
  const newsStatus = baseNewsStatus === "ok" && news.status === "fulfilled"
    && news.value.value.sources.loaded < news.value.value.sources.total ? "partial" : baseNewsStatus;
  const baseWeatherStatus = snapshotStatus(weather);
  const observationStatus = baseWeatherStatus === "ok" && weather.status === "fulfilled"
    && weather.value.value.sources.some((source) => source.status === "error") ? "partial" : baseWeatherStatus;
  const warningStatus = snapshotStatus(warnings);
  const sources: NowResponse["sources"] = [
    { area: "news", status: newsStatus },
    { area: "weather", status: combineStatuses(observationStatus, warningStatus) },
    { area: "ratings", status: snapshotStatus(ratings) },
    { area: "riigikogu", status: riigikogu.status === "rejected" ? "unavailable"
      : riigikogu.value.state === "ok" && newestVote && !riigikoguVote ? "partial" : riigikogu.value.state },
    { area: "economy", status: economy.status === "rejected" || economy.value.status === "failed"
      ? "unavailable" : economy.value.status === "partial" ? "partial" : "ok" },
    { area: "political-finance", status: finance.status === "rejected" ? "unavailable" : finance.value.source.status },
  ];
  const sourceValue = <T>(result: PromiseSettledResult<SnapshotCacheResult<T>>): T | undefined =>
    result.status === "fulfilled" ? result.value.value : undefined;
  return {
    cards: buildNowCards({
      news: sourceValue(news), weather: sourceValue(weather), ratings: sourceValue(ratings), warnings: sourceValue(warnings),
      riigikogu: riigikogu.status === "fulfilled" ? riigikogu.value : undefined,
      riigikoguVote,
      economy: economy.status === "fulfilled" ? economy.value : undefined,
      politicalFinance: finance.status === "fulfilled" ? finance.value : undefined,
    }),
    sources,
    generatedAt: new Date().toISOString(),
  };
}

export async function handleNowGet(): Promise<Response> {
  try {
    const response = await buildNowResponse();
    const healthy = response.sources.every((source) => source.status === "ok");
    return Response.json(response, {
      headers: { "Cache-Control": healthy ? "public, max-age=15, s-maxage=30, stale-while-revalidate=60" : "no-store" },
    });
  } catch (error) {
    console.error("Praegu overview failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Praegu ülevaate koostamine ebaõnnestus." }, {
      status: 502, headers: { "Cache-Control": "no-store" },
    });
  }
}
