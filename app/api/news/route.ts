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

const MAX_NEWS_ITEMS = 117;
const MAX_FEED_BYTES = 5_000_000;
const MAX_FEED_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const parser = new Parser<Record<string, never>, CustomItem>({
  customFields: {
    item: ["content:encoded"],
  },
});

function normalizeUrl(value: string | undefined, baseUrl?: string): string | null {
  if (!value) return null;

  try {
    const url = baseUrl ? new URL(value.trim(), baseUrl) : new URL(value.trim());
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

function canonicalLink(
  value: string | undefined,
  allowedRoot: FeedDefinition["allowedRoot"],
  baseUrl: string,
): string | null {
  const normalized = normalizeUrl(value, baseUrl);
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

function allowedFeedRequestUrl(
  value: string,
  allowedRoot: FeedDefinition["allowedRoot"],
  baseUrl?: string,
): URL | null {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    const allowedHost = url.hostname === allowedRoot || url.hostname.endsWith(`.${allowedRoot}`);
    const standardHttpsPort = url.port === "";
    const hasNoCredentials = url.username === "" && url.password === "";
    return url.protocol === "https:" && standardHttpsPort && hasNoCredentials && allowedHost
      ? url
      : null;
  } catch {
    return null;
  }
}

function safeLogUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "invalid-url";
  }
}

function safeDiagnosticText(value: string, limit = 180): string {
  return plainText(value)
    .replace(
      /\b(token|secret|password|authorization|cookie|api[-_]?key)\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .slice(0, limit);
}

function responseDetails(response: Response): string {
  const statusText = safeDiagnosticText(response.statusText || "unknown", 60);
  const contentType = safeDiagnosticText(response.headers.get("content-type") ?? "unknown", 100);
  const server = safeDiagnosticText(response.headers.get("server") ?? "unknown", 60);
  const requestId = safeDiagnosticText(response.headers.get("cf-ray") ?? "unknown", 80);
  return [
    `status=${response.status} ${statusText}`,
    `finalUrl=${safeLogUrl(response.url)}`,
    `redirected=${response.redirected}`,
    `contentType=${contentType}`,
    `server=${server}`,
    `requestId=${requestId}`,
  ].join("; ");
}

function looksLikeFeedXml(value: string): boolean {
  const prefix = value.replace(/^\uFEFF/, "").trimStart().slice(0, 2_048);
  return /<(?:rss|feed|rdf:RDF)\b/i.test(prefix);
}

async function discardBody(response: Response): Promise<void> {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
    // The redirect response is no longer needed; cancellation is best-effort.
  }
}

async function fetchFeedResponse(feed: FeedDefinition, headers: HeadersInit): Promise<Response> {
  const signal = AbortSignal.timeout(15_000);
  let currentUrl = allowedFeedRequestUrl(feed.url, feed.allowedRoot);
  if (!currentUrl) throw new Error("Configured feed URL is outside the approved HTTPS host");

  for (let redirectCount = 0; redirectCount <= MAX_FEED_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl, {
      headers,
      next: { revalidate },
      redirect: "manual",
      signal,
    });

    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) {
      await discardBody(response);
      throw new Error(`Feed redirect had no destination (${responseDetails(response)})`);
    }
    if (redirectCount === MAX_FEED_REDIRECTS) {
      await discardBody(response);
      throw new Error(`Feed exceeded ${MAX_FEED_REDIRECTS} redirects (${responseDetails(response)})`);
    }

    const nextUrl = allowedFeedRequestUrl(location, feed.allowedRoot, currentUrl.toString());
    if (!nextUrl) {
      await discardBody(response);
      throw new Error(`Feed redirect left the approved HTTPS host (${responseDetails(response)})`);
    }

    await discardBody(response);
    currentUrl = nextUrl;
  }

  throw new Error("Feed redirect handling ended unexpectedly");
}

async function readBodyPrefix(response: Response, maxBytes = 2_048): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let remaining = maxBytes;
  let text = "";

  try {
    while (remaining > 0) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return text;
      }

      const chunk = value.subarray(0, remaining);
      text += decoder.decode(chunk, { stream: true });
      remaining -= chunk.byteLength;

      if (chunk.byteLength < value.byteLength) break;
    }

    await reader.cancel();
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

async function readFeedBody(response: Response): Promise<{ bytes: number; text: string }> {
  const declaredLength = response.headers.get("content-length")?.trim();
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    const declaredBytes = Number(declaredLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_FEED_BYTES) {
      await discardBody(response);
      throw new Error(
        `Feed response was unexpectedly large (${responseDetails(response)}; bytes=${declaredBytes})`,
      );
    }
  }

  if (!response.body) return { bytes: 0, text: "" };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new Error(
          `Feed response was unexpectedly large (${responseDetails(response)}; bytes>${MAX_FEED_BYTES})`,
        );
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return { bytes, text };
  } finally {
    reader.releaseLock();
  }
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
  const isPostimees = feed.allowedRoot === "postimees.ee";
  const headers: HeadersInit = {
    Accept: isPostimees
      ? "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5"
      : "application/rss+xml, application/xml, text/xml",
    ...(isPostimees
      ? {
          "Accept-Language": "et-EE,et;q=0.9,en;q=0.6",
          "User-Agent": "Mozilla/5.0 (compatible; 117.ee RSS reader/1.0; +https://117.ee)",
        }
      : { "User-Agent": "117.ee RSS reader (+https://117.ee)" }),
  };
  const response = await fetchFeedResponse(feed, headers);

  if (!response.ok) {
    const bodyPrefix = safeDiagnosticText(await readBodyPrefix(response)) || "empty body";
    throw new Error(`Feed request failed (${responseDetails(response)}; bodyPrefix=${bodyPrefix})`);
  }

  const { bytes, text: xml } = await readFeedBody(response);
  if (!looksLikeFeedXml(xml)) {
    const bodyPrefix = safeDiagnosticText(xml) || "empty body";
    throw new Error(
      `Feed response was not RSS/Atom XML (${responseDetails(response)}; bytes=${bytes}; bodyPrefix=${bodyPrefix})`,
    );
  }

  let parsed: Awaited<ReturnType<typeof parser.parseString>>;
  try {
    parsed = await parser.parseString(xml);
  } catch (error) {
    const reason = safeDiagnosticText(error instanceof Error ? error.message : String(error));
    throw new Error(
      `Feed XML parsing failed (${responseDetails(response)}; bytes=${bytes}; reason=${reason || "unknown"})`,
    );
  }

  let missingLinkCount = 0;
  let missingTitleCount = 0;
  const inspectedItems = parsed.items.slice(0, 50);
  const items = inspectedItems.flatMap((raw) => {
    const item = raw as Parser.Item & CustomItem;
    const link = [item.link, item.guid]
      .map((candidate) => canonicalLink(candidate, feed.allowedRoot, response.url))
      .find((candidate): candidate is string => candidate !== null) ?? null;
    const title = plainText(item.title);
    if (!link) missingLinkCount += 1;
    if (!title) missingTitleCount += 1;
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
    throw new Error(
      `Feed contained no valid items (${responseDetails(response)}; parsedItems=${parsed.items.length}; inspectedItems=${inspectedItems.length}; missingLinks=${missingLinkCount}; missingTitles=${missingTitleCount})`,
    );
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
