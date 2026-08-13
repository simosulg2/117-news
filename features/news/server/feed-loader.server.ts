import { createHash } from "node:crypto";
import Parser from "rss-parser";

import {
  MAX_INSPECTED_FEED_ITEMS,
  type FeedDefinition,
} from "@/features/news/server/feed-config";
import {
  feedResponseDetails,
  looksLikeFeedXml,
  plainFeedText,
  resolveFeedCategory,
  safeFeedDiagnosticText,
  shortenFeedText,
} from "@/features/news/server/feed-content";
import {
  fetchFeedResponse,
  readBodyPrefix,
  readFeedBody,
} from "@/features/news/server/feed-http.server";
import { resolveArticleLink } from "@/lib/feed-links";
import {
  FeedLoadError,
  normalizeFeedRequestError,
  withFeedRetry,
} from "@/lib/feed-retry";
import type { NewsArticle } from "@/lib/types";

type CustomItem = {
  "content:encoded"?: string;
  "content:encodedSnippet"?: string;
};

const parser = new Parser<Record<string, never>, CustomItem>({
  customFields: {
    item: ["content:encoded"],
  },
});

async function loadFeedOnce(feed: FeedDefinition): Promise<NewsArticle[]> {
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
    let bodyPrefix = "unavailable";
    try {
      bodyPrefix = safeFeedDiagnosticText(await readBodyPrefix(response)) || "empty body";
    } catch {
      // The HTTP status remains authoritative if its diagnostic body cannot be read.
    }
    throw new FeedLoadError(
      "http",
      `Feed request failed (${feedResponseDetails(response)}; bodyPrefix=${bodyPrefix})`,
      response.status,
    );
  }

  let feedBody: Awaited<ReturnType<typeof readFeedBody>>;
  try {
    feedBody = await readFeedBody(response);
  } catch (error) {
    throw normalizeFeedRequestError(error);
  }
  const { bytes, text: xml } = feedBody;
  if (!looksLikeFeedXml(xml)) {
    const bodyPrefix = safeFeedDiagnosticText(xml) || "empty body";
    throw new FeedLoadError(
      "invalid_content",
      `Feed response was not RSS/Atom XML (${feedResponseDetails(response)}; bytes=${bytes}; bodyPrefix=${bodyPrefix})`,
    );
  }

  let parsed: Awaited<ReturnType<typeof parser.parseString>>;
  try {
    parsed = await parser.parseString(xml);
  } catch (error) {
    const reason = safeFeedDiagnosticText(error instanceof Error ? error.message : String(error));
    throw new FeedLoadError(
      "parse",
      `Feed XML parsing failed (${feedResponseDetails(response)}; bytes=${bytes}; reason=${reason || "unknown"})`,
    );
  }

  let missingLinkCount = 0;
  let missingTitleCount = 0;
  const inspectedItems = parsed.items.slice(0, MAX_INSPECTED_FEED_ITEMS);
  const items = inspectedItems.flatMap((raw) => {
    const item = raw as Parser.Item & CustomItem;
    const link = resolveArticleLink(item.link, item.guid, feed.allowedRoot, response.url);
    const title = plainFeedText(item.title);
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
    const summary = shortenFeedText(plainFeedText(summarySource));

    return [
      {
        id: createHash("sha1").update(link).digest("hex").slice(0, 16),
        title,
        link,
        summary,
        publishedAt,
        category: resolveFeedCategory(feed, item, link),
        source: feed.source,
      },
    ];
  });

  if (items.length === 0) {
    throw new FeedLoadError(
      "no_valid_items",
      `Feed contained no valid items (${feedResponseDetails(response)}; parsedItems=${parsed.items.length}; inspectedItems=${inspectedItems.length}; missingLinks=${missingLinkCount}; missingTitles=${missingTitleCount})`,
    );
  }

  return items;
}

export async function loadFeed(feed: FeedDefinition): Promise<NewsArticle[]> {
  return withFeedRetry(() => loadFeedOnce(feed));
}
