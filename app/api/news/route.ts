import { createHash } from "node:crypto";
import Parser from "rss-parser";

import { groupNewsItems } from "@/lib/group-stories";
import type {
  FeedCategory,
  FeedName,
  NewsArticle,
  NewsResponse,
  NewsSource,
} from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 300;

type CustomItem = {
  "content:encoded"?: string;
  "content:encodedSnippet"?: string;
};

type FeedDefinition = {
  name: FeedName;
  category: FeedCategory | null;
  source: NewsSource;
  url: string;
  allowedRoot: "err.ee" | "postimees.ee";
};

const FEEDS: ReadonlyArray<FeedDefinition> = [
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
    url: "https://lounapostimees.postimees.ee/rss/",
    allowedRoot: "postimees.ee",
  },
  {
    name: "Postimees",
    category: null,
    source: "Postimees",
    url: "https://postimees.ee/rss/",
    allowedRoot: "postimees.ee",
  },
];

const MAX_NEWS_ITEMS = 117;

const parser = new Parser<Record<string, never>, CustomItem>({
  customFields: {
    item: ["content:encoded"],
  },
});

function normalizeUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function plainText(value: string | undefined): string {
  if (!value) return "";

  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: string, limit = 230): string {
  if (value.length <= limit) return value;
  const shortened = value.slice(0, limit + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > limit * 0.7 ? lastSpace : limit).trim()}…`;
}

function canonicalLink(value: string | undefined, allowedRoot: FeedDefinition["allowedRoot"]): string | null {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;

  const url = new URL(normalized);
  if (url.hostname !== allowedRoot && !url.hostname.endsWith(`.${allowedRoot}`)) return null;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLocaleLowerCase("en-US");
    if (
      normalizedKey.startsWith("utm_")
      || normalizedKey === "ref"
      || normalizedKey === "fbclid"
      || normalizedKey === "gclid"
    ) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

function normalizedCategoryText(value: string): string {
  return value
    .toLocaleLowerCase("et-EE")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

function resolveCategory(feed: FeedDefinition, item: Parser.Item, link: string): FeedCategory {
  if (feed.category) return feed.category;

  const categoryText = normalizedCategoryText((item.categories ?? []).join(" "));
  const articleUrl = new URL(link);
  const linkText = normalizedCategoryText(
    `${articleUrl.hostname} ${articleUrl.pathname.replaceAll("-", " ")}`,
  );
  const searchable = `${categoryText} ${linkText}`;

  if (/\b(sport|jalgpall|korvpall|tennis|ralli|motosport)\b/.test(searchable)) return "Sport";
  if (/\b(majandus|raha|investor|ettevotlus|business)\b/.test(searchable)) return "Majandus";
  return "Eesti";
}

async function loadFeed(feed: (typeof FEEDS)[number]): Promise<NewsArticle[]> {
  const response = await fetch(feed.url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "117.ee RSS reader (+https://117.ee)",
    },
    next: { revalidate },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Feed returned ${response.status}`);
  }

  const xml = await response.text();
  if (xml.length > 5_000_000) {
    throw new Error("Feed response was unexpectedly large");
  }
  const parsed = await parser.parseString(xml);

  const items = parsed.items.slice(0, 50).flatMap((raw) => {
    const item = raw as Parser.Item & CustomItem;
    const link = canonicalLink(item.link ?? item.guid, feed.allowedRoot);
    const title = plainText(item.title);
    if (!link || !title) return [];

    const date = item.isoDate ?? item.pubDate;
    const parsedDate = date ? new Date(date) : new Date(0);
    const publishedAt = Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() === 0
      ? null
      : parsedDate.toISOString();

    const summarySource = item.contentSnippet
      ?? item["content:encodedSnippet"]
      ?? item.content
      ?? item["content:encoded"];
    const summary = shorten(plainText(summarySource));

    return [
      {
        id: createHash("sha1").update(link).digest("hex").slice(0, 16),
        title,
        link,
        summary,
        publishedAt,
        category: resolveCategory(feed, item, link),
        source: feed.source,
      },
    ];
  });

  if (items.length === 0) {
    throw new Error("Feed contained no valid items");
  }

  return items;
}

export async function GET(): Promise<Response> {
  const settled = await Promise.allSettled(FEEDS.map(loadFeed));
  const failed: FeedName[] = [];
  const byLink = new Map<string, NewsArticle>();

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      failed.push(FEEDS[index].name);
      console.error(`Failed to load ${FEEDS[index].name} feed`, result.reason);
      return;
    }

    for (const item of result.value) {
      if (!byLink.has(item.link)) byLink.set(item.link, item);
    }
  });

  const generatedAt = new Date();
  const items = groupNewsItems([...byLink.values()], generatedAt).slice(0, MAX_NEWS_ITEMS);

  if (items.length === 0) {
    return Response.json(
      { error: "Uudiste laadimine ebaõnnestus. Palun proovi mõne hetke pärast uuesti." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload: NewsResponse = {
    items,
    updatedAt: generatedAt.toISOString(),
    sources: {
      loaded: FEEDS.length - failed.length,
      total: FEEDS.length,
      failed,
    },
  };

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
