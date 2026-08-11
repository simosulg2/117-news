import { createHash } from "node:crypto";
import Parser from "rss-parser";

import type { FeedCategory, NewsItem, NewsResponse } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 300;

type MediaNode = {
  $?: {
    url?: string;
    medium?: string;
    type?: string;
  };
};

type CustomItem = {
  mediaContent?: MediaNode[];
  mediaThumbnail?: MediaNode[];
  "content:encoded"?: string;
};

const FEEDS: ReadonlyArray<{ category: FeedCategory; url: string }> = [
  { category: "Eesti", url: "https://www.err.ee/rss/eesti" },
  { category: "Majandus", url: "https://www.err.ee/rss/majandus" },
  { category: "Kultuur", url: "https://www.err.ee/rss/kultuur" },
  { category: "Sport", url: "https://sport.err.ee/rss" },
  { category: "English", url: "https://news.err.ee/rss" },
  { category: "Viimased", url: "https://www.err.ee/rss" },
];

const parser = new Parser<Record<string, never>, CustomItem>({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      "content:encoded",
    ],
  },
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeUrl(value: string | undefined, httpsOnly = false): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && (!httpsOnly && url.protocol !== "http:")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function pickImage(item: Parser.Item & CustomItem): string | null {
  const enclosure = normalizeUrl(item.enclosure?.url, true);
  if (enclosure && (!item.enclosure?.type || item.enclosure.type.startsWith("image/"))) {
    return enclosure;
  }

  const media = [
    ...asArray(item.mediaThumbnail),
    ...asArray(item.mediaContent),
  ];

  for (const node of media) {
    const candidate = normalizeUrl(node?.$?.url, true);
    if (candidate) return candidate;
  }

  const html = item["content:encoded"] ?? item.content ?? item.contentSnippet ?? "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return normalizeUrl(match?.[1], true);
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
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: string, limit = 230): string {
  if (value.length <= limit) return value;
  const shortened = value.slice(0, limit + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > limit * 0.7 ? lastSpace : limit).trim()}…`;
}

function canonicalLink(value: string | undefined): string | null {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;

  const url = new URL(normalized);
  if (url.hostname !== "err.ee" && !url.hostname.endsWith(".err.ee")) return null;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "ref") url.searchParams.delete(key);
  }
  return url.toString();
}

async function loadFeed(feed: (typeof FEEDS)[number]): Promise<NewsItem[]> {
  const response = await fetch(feed.url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml",
      "User-Agent": "117.ee RSS reader (+https://117.ee)",
    },
    next: { revalidate },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`ERR feed returned ${response.status}`);
  }

  const xml = await response.text();
  if (xml.length > 2_000_000) {
    throw new Error("ERR feed response was unexpectedly large");
  }
  const parsed = await parser.parseString(xml);

  return parsed.items.slice(0, 50).flatMap((raw) => {
    const item = raw as Parser.Item & CustomItem;
    const link = canonicalLink(item.link ?? item.guid);
    const title = plainText(item.title);
    if (!link || !title) return [];

    const date = item.isoDate ?? item.pubDate;
    const parsedDate = date ? new Date(date) : new Date(0);
    const publishedAt = Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() === 0
      ? null
      : parsedDate.toISOString();

    const summarySource = item.contentSnippet ?? item.content ?? item["content:encoded"];
    const summary = shorten(plainText(summarySource));

    return [
      {
        id: createHash("sha1").update(link).digest("hex").slice(0, 16),
        title,
        link,
        summary,
        publishedAt,
        category: feed.category,
        imageUrl: pickImage(item),
      },
    ];
  });
}

export async function GET(): Promise<Response> {
  const settled = await Promise.allSettled(FEEDS.map(loadFeed));
  const failed: FeedCategory[] = [];
  const byLink = new Map<string, NewsItem>();

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      failed.push(FEEDS[index].category);
      console.error(`Failed to load ${FEEDS[index].category} feed`, result.reason);
      return;
    }

    for (const item of result.value) {
      if (!byLink.has(item.link)) byLink.set(item.link, item);
    }
  });

  const items = [...byLink.values()]
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    })
    .slice(0, 120);

  if (items.length === 0) {
    return Response.json(
      { error: "Uudiste laadimine ebaõnnestus. Palun proovi mõne hetke pärast uuesti." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload: NewsResponse = {
    items,
    updatedAt: new Date().toISOString(),
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
