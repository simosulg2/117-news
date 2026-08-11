export const FEED_CATEGORIES = [
  "Eesti",
  "Majandus",
  "Sport",
] as const;

export const CATEGORIES = ["Kõik", ...FEED_CATEGORIES] as const;

export type Category = (typeof CATEGORIES)[number];
export type FeedCategory = (typeof FEED_CATEGORIES)[number];
export type NewsSource = "ERR" | "Postimees" | "Lõuna PM";
export type FeedName = "ERR Eesti" | "ERR Majandus" | "ERR Sport" | "Postimees" | "Lõuna-Eesti Postimees";

export type FeedFailureCode =
  | "configuration"
  | "http"
  | "invalid_content"
  | "network"
  | "no_valid_items"
  | "parse"
  | "redirect"
  | "response_too_large"
  | "timeout"
  | "unknown";

export type FeedFailure =
  | { name: FeedName; code: "http"; status: number }
  | { name: FeedName; code: Exclude<FeedFailureCode, "http"> };

export type NewsArticle = {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  category: FeedCategory;
  source: NewsSource;
};

export type NewsItem = NewsArticle & {
  related: NewsArticle[];
};

export type NewsItemsByCategory = Record<FeedCategory, NewsItem[]>;

export type NewsResponse = {
  items: NewsItem[];
  itemsByCategory?: NewsItemsByCategory;
  updatedAt: string;
  sources: {
    loaded: number;
    total: number;
    failed: FeedName[];
    failures: FeedFailure[];
  };
};
