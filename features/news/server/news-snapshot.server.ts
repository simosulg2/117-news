import { NEWS_STORY_ACTIVE_WINDOW_MS, NEWS_STORY_RETENTION_MS } from "@/features/news/model/story-evolution";
import { loadNewsFeedBatch } from "@/features/news/server/news-feed-batch.server";
import {
  newsStoryDatabaseConfigured,
  safeNewsStoryDatabaseErrorDetails,
} from "@/features/news/server/news-story-database.server";
import {
  loadNewsStoryAssociations,
  loadStoredNewsOverview,
} from "@/features/news/server/news-story-read.server";
import { buildNewsCollections, buildPersistentNewsCollections } from "@/lib/news-collections";
import type { NewsResponse } from "@/lib/types";

export type NewsUnavailableBody = {
  error: string;
  sources: NewsResponse["sources"];
};

export class NewsSnapshotRefreshError extends Error {
  readonly responseBody: NewsUnavailableBody;

  constructor(responseBody: NewsUnavailableBody) {
    super(responseBody.error);
    this.name = "NewsSnapshotRefreshError";
    this.responseBody = responseBody;
  }
}

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

function storyHistory(
  mode: NewsResponse["storyHistory"]["mode"],
  storedFallback: boolean,
): NewsResponse["storyHistory"] {
  return {
    mode,
    activeWindowHours: NEWS_STORY_ACTIVE_WINDOW_MS / HOUR_MS,
    retentionDays: mode === "persistent" ? NEWS_STORY_RETENTION_MS / DAY_MS : null,
    storedFallback,
  };
}

export async function refreshNewsSnapshot(): Promise<NewsResponse> {
  const batch = await loadNewsFeedBatch();
  const generatedAt = new Date();
  const persistenceEnabled = newsStoryDatabaseConfigured();

  if (batch.articles.length === 0 && persistenceEnabled) {
    try {
      const stored = await loadStoredNewsOverview(generatedAt);
      if (stored) {
        return {
          ...buildPersistentNewsCollections(stored.articles, stored.associations, generatedAt),
          updatedAt: stored.updatedAt,
          storyHistory: storyHistory("persistent", true),
          sources: batch.sources,
        };
      }
    } catch (error) {
      console.error("News story fallback read failed", safeNewsStoryDatabaseErrorDetails(error));
    }
  }

  if (batch.articles.length === 0) {
    throw new NewsSnapshotRefreshError({
      error: "Uudiste laadimine ebaõnnestus. Palun proovi mõne hetke pärast uuesti.",
      sources: batch.sources,
    });
  }

  let collections = buildNewsCollections(batch.articles, generatedAt);
  let mode: NewsResponse["storyHistory"]["mode"] = "snapshot";
  if (persistenceEnabled) {
    try {
      const associations = await loadNewsStoryAssociations(batch.articles.map(({ id }) => id));
      collections = buildPersistentNewsCollections(batch.articles, associations, generatedAt);
      mode = "persistent";
    } catch (error) {
      console.error("News story association read failed", safeNewsStoryDatabaseErrorDetails(error));
    }
  }

  return {
    ...collections,
    updatedAt: generatedAt.toISOString(),
    storyHistory: storyHistory(mode, false),
    sources: batch.sources,
  };
}
