export const CATEGORIES = [
  "Kõik",
  "Eesti",
  "Majandus",
  "Sport",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type FeedCategory = Exclude<Category, "Kõik">;
export type NewsSource = "ERR" | "Postimees" | "Lõuna PM";
export type FeedName = "ERR Eesti" | "ERR Majandus" | "ERR Sport" | "Postimees" | "Lõuna-Eesti Postimees";

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

export type NewsResponse = {
  items: NewsItem[];
  updatedAt: string;
  sources: {
    loaded: number;
    total: number;
    failed: FeedName[];
  };
};
