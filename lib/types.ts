export const CATEGORIES = [
  "Kõik",
  "Eesti",
  "Majandus",
  "Sport",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type FeedCategory = Exclude<Category, "Kõik">;
export type NewsSource = "ERR";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  category: FeedCategory;
  source: NewsSource;
};

export type NewsResponse = {
  items: NewsItem[];
  updatedAt: string;
  sources: {
    loaded: number;
    total: number;
    failed: FeedCategory[];
  };
};
