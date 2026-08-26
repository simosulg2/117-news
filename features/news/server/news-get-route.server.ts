import {
  NEWS_FEEDS,
  NEWS_SNAPSHOT_TTL_MS,
  NEWS_STALE_RETRY_DELAY_MS,
} from "@/features/news/server/feed-config";
import {
  NewsSnapshotRefreshError,
  refreshNewsSnapshot,
  type NewsUnavailableBody,
} from "@/features/news/server/news-snapshot.server";
import { safeNewsStoryDatabaseErrorDetails } from "@/features/news/server/news-story-database.server";
import { InProcessSnapshotCache } from "@/lib/snapshot-cache";
import type { NewsResponse } from "@/lib/types";

const newsSnapshotCache = new InProcessSnapshotCache<NewsResponse>(
  NEWS_SNAPSHOT_TTL_MS,
  NEWS_STALE_RETRY_DELAY_MS,
);

export async function handleNewsGet(request: Request): Promise<Response> {
  if (new URL(request.url).searchParams.has("collect")) {
    return Response.json(
      { ok: false, code: "collector_requires_post" },
      { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } },
    );
  }

  try {
    const snapshot = await newsSnapshotCache.get(refreshNewsSnapshot);
    return Response.json(snapshot.value, {
      headers: {
        "Cache-Control": "no-store",
        "X-News-Snapshot": snapshot.status,
      },
    });
  } catch (error) {
    if (!(error instanceof NewsSnapshotRefreshError)) {
      console.error("Failed to refresh news snapshot", safeNewsStoryDatabaseErrorDetails(error));
    }
    const responseBody: NewsUnavailableBody = error instanceof NewsSnapshotRefreshError
      ? error.responseBody
      : {
          error: "Uudiste laadimine ebaõnnestus. Palun proovi mõne hetke pärast uuesti.",
          sources: {
            loaded: 0,
            total: NEWS_FEEDS.length,
            failed: [],
            failures: [],
          },
        };
    return Response.json(responseBody, {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "X-News-Snapshot": "unavailable",
      },
    });
  }
}
