import type { FeedRoot } from "@/lib/feed-links";
import type { FeedCategory, FeedName, NewsSource } from "@/lib/types";

export type FeedDefinition = {
  name: FeedName;
  category: FeedCategory | null;
  source: NewsSource;
  url: string;
  allowedRoot: FeedRoot;
};

export const NEWS_FEEDS: ReadonlyArray<FeedDefinition> = [
  {
    name: "ERR Eesti",
    category: "Eesti",
    source: "ERR",
    url: "https://www.err.ee/rss/eesti",
    allowedRoot: "err.ee",
  },
  {
    name: "ERR Majandus",
    category: "Majandus",
    source: "ERR",
    url: "https://www.err.ee/rss/majandus",
    allowedRoot: "err.ee",
  },
  {
    name: "ERR Sport",
    category: "Sport",
    source: "ERR",
    url: "https://sport.err.ee/rss",
    allowedRoot: "err.ee",
  },
  {
    name: "Lõuna-Eesti Postimees",
    category: "Eesti",
    source: "Lõuna PM",
    url: "https://lounapostimees.postimees.ee/rss",
    allowedRoot: "postimees.ee",
  },
  {
    name: "Postimees",
    category: null,
    source: "Postimees",
    url: "https://www.postimees.ee/rss",
    allowedRoot: "postimees.ee",
  },
];

export const MAX_INSPECTED_FEED_ITEMS = 117;
export const MAX_FEED_BYTES = 5_000_000;
export const MAX_FEED_REDIRECTS = 3;
export const FEED_REQUEST_TIMEOUT_MS = 15_000;
export const NEWS_SNAPSHOT_TTL_MS = 5 * 60 * 1_000;
export const NEWS_STALE_RETRY_DELAY_MS = 30_000;
