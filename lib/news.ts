import "server-only";
import Parser from "rss-parser";

export const FEEDS = [
  { name: "Viimased", url: "https://www.err.ee/rss" },
  { name: "Eesti", url: "https://www.err.ee/rss/eesti" },
  { name: "Majandus", url: "https://www.err.ee/rss/majandus" },
  { name: "Kultuur", url: "https://www.err.ee/rss/kultuur" },
  { name: "Sport", url: "https://sport.err.ee/rss" },
  { name: "English", url: "https://news.err.ee/rss" },
] as const;

export type FeedCategory = (typeof FEEDS)[number]["name"];

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string;
  image: string | null;
  categories: FeedCategory[];
};

type CustomItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  description?: string;
  enclosure?: { url?: string };
  "content:encoded"?: string;
  "media:content"?: { $?: { url?: string }; url?: string };
  "media:thumbnail"?: { $?: { url?: string }; url?: string };
};

const parser = new Parser<Record<string, never>, CustomItem>({
  customFields: {
    item: ["description", "content:encoded", "media:content", "media:thumbnail"],
  },
});

function stripHtml(value = "") {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function findImage(item: CustomItem): string | null {
  const mediaContent = item["media:content"];
  const mediaThumbnail = item["media:thumbnail"];
  const direct =
    item.enclosure?.url ||
    mediaContent?.$?.url ||
    mediaContent?.url ||
    mediaThumbnail?.$?.url ||
    mediaThumbnail?.url;

  if (direct) return direct;

  const html = [item["content:encoded"], item.content, item.description]
    .filter(Boolean)
    .join(" ");
  return html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
}

async function fetchFeed(name: FeedCategory, url: string): Promise<NewsItem[]> {
  const response = await fetch(url, {
    headers: { "User-Agent": "117.ee RSS reader/1.0" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new Error(`${name} feed returned ${response.status}`);

  const xml = await response.text();
  const feed = await parser.parseString(xml);

  return feed.items
    .filter((item) => item.title && item.link)
    .map((item) => {
      const rawSummary = item.contentSnippet || item.description || item.content || "";
      const summary = stripHtml(rawSummary);
      return {
        id: item.guid || item.link!,
        title: stripHtml(item.title),
        link: item.link!,
        summary: summary.length > 240 ? `${summary.slice(0, 237).trimEnd()}…` : summary,
        publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
        image: findImage(item),
        categories: [name],
      };
    });
}

export async function getNews(): Promise<{ items: NewsItem[]; failedFeeds: FeedCategory[] }> {
  const settled = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed.name, feed.url)));
  const failedFeeds: FeedCategory[] = [];
  const merged = new Map<string, NewsItem>();

  settled.forEach((result, index) => {
    const feedName = FEEDS[index].name;
    if (result.status === "rejected") {
      failedFeeds.push(feedName);
      console.error(`[RSS] ${feedName}:`, result.reason);
      return;
    }

    for (const item of result.value) {
      const existing = merged.get(item.link);
      if (existing) {
        if (!existing.categories.includes(feedName)) existing.categories.push(feedName);
        if (existing.categories.length > 1) {
          existing.categories = existing.categories.filter((category) => category !== "Viimased");
        }
      } else {
        merged.set(item.link, item);
      }
    }
  });

  const items = [...merged.values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 90);

  return { items, failedFeeds };
}
