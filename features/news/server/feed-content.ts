import type Parser from "rss-parser";

import type { FeedDefinition } from "@/features/news/server/feed-config";
import { feedCategoryText } from "../../../lib/feed-categories.ts";
import type { FeedCategory } from "@/lib/types";

export function plainFeedText(value: string | undefined): string {
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

export function shortenFeedText(value: string, limit = 230): string {
  if (value.length <= limit) return value;
  const shortened = value.slice(0, limit + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > limit * 0.7 ? lastSpace : limit).trim()}…`;
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

export function safeFeedDiagnosticText(value: string, limit = 180): string {
  return plainFeedText(value)
    .replace(
      /\b(token|secret|password|authorization|cookie|api[-_]?key)\s*[:=]\s*\S+/gi,
      "$1=[redacted]",
    )
    .slice(0, limit);
}

export function feedResponseDetails(response: Response): string {
  const statusText = safeFeedDiagnosticText(response.statusText || "unknown", 60);
  const contentType = safeFeedDiagnosticText(response.headers.get("content-type") ?? "unknown", 100);
  const server = safeFeedDiagnosticText(response.headers.get("server") ?? "unknown", 60);
  const requestId = safeFeedDiagnosticText(response.headers.get("cf-ray") ?? "unknown", 80);
  return [
    `status=${response.status} ${statusText}`,
    `finalUrl=${safeLogUrl(response.url)}`,
    `redirected=${response.redirected}`,
    `contentType=${contentType}`,
    `server=${server}`,
    `requestId=${requestId}`,
  ].join("; ");
}

export function looksLikeFeedXml(value: string): boolean {
  const prefix = value.replace(/^\uFEFF/, "").trimStart().slice(0, 2_048);
  return /<(?:rss|feed|rdf:RDF)\b/i.test(prefix);
}

function normalizedCategoryText(value: string): string {
  return value
    .toLocaleLowerCase("et-EE")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}

export function resolveFeedCategory(
  feed: FeedDefinition,
  item: Parser.Item,
  link: string,
): FeedCategory {
  if (feed.category) return feed.category;

  const categoryText = normalizedCategoryText(feedCategoryText(item.categories));
  const articleUrl = new URL(link);
  const linkText = normalizedCategoryText(
    `${articleUrl.hostname} ${articleUrl.pathname.replaceAll("-", " ")}`,
  );
  const searchable = `${categoryText} ${linkText}`;

  if (/\b(sport|jalgpall|korvpall|tennis|ralli|motosport)\b/.test(searchable)) return "Sport";
  if (/\b(majandus|raha|investor|ettevotlus|business)\b/.test(searchable)) return "Majandus";
  return "Eesti";
}
