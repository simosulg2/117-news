import { createHash } from "node:crypto";

import {
  groupNewsItems,
  normalizeStoryTitle,
  storyTitleSimilarity,
} from "../../../lib/group-stories.ts";
import type { NewsArticle } from "../../../lib/types.ts";
import { NEWS_STORY_ACTIVE_WINDOW_MS } from "../model/story-evolution.ts";

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1_000;
const MAX_ARTICLE_ID_LENGTH = 128;
const MAX_LINK_LENGTH = 4_096;
const MAX_TITLE_LENGTH = 1_000;
const MAX_SUMMARY_LENGTH = 2_000;

export type PersistableNewsArticle = {
  article: NewsArticle;
  activityAt: Date;
  contentHash: string;
  publishedAt: Date | null;
};

function boundedText(value: string, maximum: number, allowEmpty: boolean): boolean {
  return value.length <= maximum && (allowEmpty || value.trim().length > 0);
}

export function persistableNewsArticle(
  article: NewsArticle,
  collectedAt: Date,
): PersistableNewsArticle | null {
  if (
    !boundedText(article.id, MAX_ARTICLE_ID_LENGTH, false)
    || !boundedText(article.link, MAX_LINK_LENGTH, false)
    || !boundedText(article.title, MAX_TITLE_LENGTH, false)
    || !boundedText(article.summary, MAX_SUMMARY_LENGTH, true)
  ) return null;

  const parsed = article.publishedAt ? new Date(article.publishedAt) : null;
  const publishedAt = parsed
    && Number.isFinite(parsed.getTime())
    && parsed.getTime() <= collectedAt.getTime() + MAX_FUTURE_SKEW_MS
    ? parsed
    : null;
  const activityAt = publishedAt ?? collectedAt;
  const contentHash = createHash("sha256")
    .update(article.title, "utf8")
    .update("\0", "utf8")
    .update(article.summary, "utf8")
    .digest("hex");
  return { article, activityAt, contentHash, publishedAt };
}

export type CoverageAnchor = Pick<
  NewsArticle,
  "id" | "title" | "summary" | "publishedAt" | "category" | "source"
>;

function asNewsArticle(anchor: CoverageAnchor): NewsArticle {
  return { ...anchor, link: `https://invalid.local/${encodeURIComponent(anchor.id)}` };
}

function isWithinActiveStoryWindow(publishedAt: string | null, now: Date): boolean {
  if (!publishedAt) return false;
  const timestamp = Date.parse(publishedAt);
  return Number.isFinite(timestamp)
    && timestamp <= now.getTime()
    && timestamp >= now.getTime() - NEWS_STORY_ACTIVE_WINDOW_MS;
}

export function strictCoverageScore(
  article: NewsArticle,
  anchor: CoverageAnchor,
  now: Date,
): number | null {
  if (article.source === anchor.source) {
    const normalizedTitle = normalizeStoryTitle(article.title);
    if (
      normalizedTitle.length === 0
      || normalizedTitle !== normalizeStoryTitle(anchor.title)
      || !isWithinActiveStoryWindow(article.publishedAt, now)
      || !isWithinActiveStoryWindow(anchor.publishedAt, now)
    ) return null;
    return 1;
  }
  if (article.category !== anchor.category) return null;
  const grouped = groupNewsItems([article, asNewsArticle(anchor)], now);
  if (grouped.length !== 1 || grouped[0].related.length !== 1) return null;
  return Math.round(storyTitleSimilarity(article.title, anchor.title) * 1_000) / 1_000;
}
