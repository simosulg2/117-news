import { NEWS_FEEDS } from "@/features/news/server/feed-config";
import { loadFeed } from "@/features/news/server/feed-loader.server";
import { publicFeedFailure } from "@/lib/feed-retry";
import { buildNewsCollections } from "@/lib/news-collections";
import type {
  FeedFailure,
  FeedName,
  NewsArticle,
  NewsResponse,
} from "@/lib/types";

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

export async function refreshNewsSnapshot(): Promise<NewsResponse> {
  const settled = await Promise.allSettled(NEWS_FEEDS.map(loadFeed));
  const failed: FeedName[] = [];
  const failures: FeedFailure[] = [];
  const byLink = new Map<string, NewsArticle>();

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      failed.push(NEWS_FEEDS[index].name);
      failures.push(publicFeedFailure(NEWS_FEEDS[index].name, result.reason));
      console.error(`Failed to load ${NEWS_FEEDS[index].name} feed`, result.reason);
      return;
    }

    for (const item of result.value) {
      if (!byLink.has(item.link)) byLink.set(item.link, item);
    }
  });

  const generatedAt = new Date();
  const collections = buildNewsCollections([...byLink.values()], generatedAt);

  if (collections.items.length === 0) {
    throw new NewsSnapshotRefreshError({
      error: "Uudiste laadimine ebaõnnestus. Palun proovi mõne hetke pärast uuesti.",
      sources: {
        loaded: 0,
        total: NEWS_FEEDS.length,
        failed,
        failures,
      },
    });
  }

  return {
    ...collections,
    updatedAt: generatedAt.toISOString(),
    sources: {
      loaded: NEWS_FEEDS.length - failed.length,
      total: NEWS_FEEDS.length,
      failed,
      failures,
    },
  };
}
