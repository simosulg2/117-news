export const CATEGORIES = [
  "Kõik",
  "Eesti",
  "Majandus",
  "Kultuur",
  "Sport",
  "English",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type FeedCategory = Exclude<Category, "Kõik"> | "Viimased";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  category: FeedCategory;
  imageUrl: string | null;
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
