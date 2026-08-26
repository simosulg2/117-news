import { NEWS_FEEDS } from "@/features/news/server/feed-config";
import { loadFeed } from "@/features/news/server/feed-loader.server";
import { publicFeedFailure } from "@/lib/feed-retry";
import type {
  FeedFailure,
  FeedName,
  NewsArticle,
  NewsResponse,
} from "@/lib/types";

export type NewsFeedBatch = {
  articles: NewsArticle[];
  sources: NewsResponse["sources"];
};

export async function loadNewsFeedBatch(): Promise<NewsFeedBatch> {
  const settled = await Promise.allSettled(NEWS_FEEDS.map(loadFeed));
  const failed: FeedName[] = [];
  const failures: FeedFailure[] = [];
  const byLink = new Map<string, NewsArticle>();

  settled.forEach((result, index) => {
    const feed = NEWS_FEEDS[index];
    if (result.status === "rejected") {
      failed.push(feed.name);
      failures.push(publicFeedFailure(feed.name, result.reason));
      console.error(`Failed to load ${feed.name} feed`, result.reason);
      return;
    }
    for (const item of result.value) {
      if (!byLink.has(item.link)) byLink.set(item.link, item);
    }
  });

  return {
    articles: [...byLink.values()],
    sources: {
      loaded: NEWS_FEEDS.length - failed.length,
      total: NEWS_FEEDS.length,
      failed,
      failures,
    },
  };
}
