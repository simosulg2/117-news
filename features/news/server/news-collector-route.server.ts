import { loadNewsFeedBatch } from "@/features/news/server/news-feed-batch.server";
import {
  authenticateNewsCollector,
  newsCollectorPublicResult,
  type NewsCollectorOutcome,
  type NewsCollectorSummary,
} from "@/features/news/server/news-collector-policy";
import {
  newsStoryDatabaseConfigured,
  safeNewsStoryDatabaseErrorDetails,
} from "@/features/news/server/news-story-database.server";
import { collectNewsStoryBatch } from "@/features/news/server/news-story-store.server";

function collectorResponse(
  outcome: NewsCollectorOutcome,
  summary?: NewsCollectorSummary,
): Response {
  const result = newsCollectorPublicResult(outcome, summary);
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (result.status === 401) {
    headers["WWW-Authenticate"] = 'Bearer realm="117.ee news collector"';
  }
  return Response.json(result.body, { status: result.status, headers });
}

export async function handleNewsPost(request: Request): Promise<Response> {
  const authorization = authenticateNewsCollector(
    request.headers.get("authorization"),
    process.env.NEWS_COLLECTOR_TOKEN,
  );
  if (authorization === "unconfigured") return collectorResponse("collector_not_configured");
  if (authorization === "unauthorized") return collectorResponse("unauthorized");
  if (!newsStoryDatabaseConfigured()) return collectorResponse("news_store_not_configured");

  let batch: Awaited<ReturnType<typeof loadNewsFeedBatch>>;
  try {
    batch = await loadNewsFeedBatch();
  } catch (error) {
    console.error("News collector feed load failed", safeNewsStoryDatabaseErrorDetails(error));
    return collectorResponse("no_sources_available");
  }
  if (batch.articles.length === 0 || batch.sources.loaded === 0) {
    return collectorResponse("no_sources_available");
  }

  try {
    const stored = await collectNewsStoryBatch(batch.articles);
    if (!stored) return collectorResponse("news_store_not_configured");
    return collectorResponse("saved", {
      collectedAt: stored.collectedAt,
      storedArticles: stored.storedArticles,
      affectedStories: stored.affectedStories,
      sourcesLoaded: batch.sources.loaded,
      sourcesTotal: batch.sources.total,
    });
  } catch (error) {
    console.error("News collector persistence failed", safeNewsStoryDatabaseErrorDetails(error));
    return collectorResponse("news_store_unavailable");
  }
}
