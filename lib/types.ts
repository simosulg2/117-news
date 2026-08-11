export const CATEGORIES = [
  "Kõik",
  "Eesti",
  "Majandus",
  "Kultuur",
  "Sport",
  "Teadus",
  "Arvamus",
  "Tehnoloogia",
  "Kultuur/Ühiskond",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type FeedCategory = Exclude<Category, "Kõik"> | "Uudised";
export type NewsSource = "ERR" | "Novaator" | "Geenius" | "Sirp";

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
