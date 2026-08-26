import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import type { NewsStoryMatchKind, NewsStoryMatchReason } from "@/lib/types";
import type { PersistableNewsArticle } from "./news-story-ingestion-model.server.ts";

type ExistingArticleRow = {
  id: string;
  link: string;
  story_id: string;
  event_id: string;
  content_hash: string;
  published_at: Date | null;
};
type VersionRow = { version: number | string };

function storyVersion(row: VersionRow | undefined): number {
  const value = Number(row?.version);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid news story version");
  return value;
}

async function insertRevision(
  client: PoolClient,
  value: PersistableNewsArticle,
  version: number,
  observedAt: Date,
): Promise<void> {
  const { article, contentHash, publishedAt } = value;
  await client.query(
    `INSERT INTO news_article_revisions (
      article_id, content_hash, title, summary, published_at, category, source,
      observed_at, story_version
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (article_id, content_hash) DO NOTHING`,
    [article.id, contentHash, article.title, article.summary, publishedAt,
      article.category, article.source, observedAt, version],
  );
}

export async function updateKnownArticle(
  client: PoolClient,
  value: PersistableNewsArticle,
  collectedAt: Date,
  affectedStories: Set<string>,
): Promise<"handled" | "collision" | "new"> {
  const result = await client.query<ExistingArticleRow>(
    `SELECT id, link, story_id, event_id, content_hash, published_at FROM news_articles
     WHERE id = $1 OR link = $2 FOR UPDATE`,
    [value.article.id, value.article.link],
  );
  if (result.rows.length === 0) return "new";
  const existing = result.rows.find((row) =>
    row.id === value.article.id && row.link === value.article.link);
  if (!existing) return "collision";
  const contentChanged = existing.content_hash !== value.contentHash;
  const publishedAtBackfill = existing.published_at === null ? value.publishedAt : null;
  if (!contentChanged && publishedAtBackfill === null) {
    await client.query("UPDATE news_articles SET last_seen_at = $2 WHERE id = $1", [existing.id, collectedAt]);
    affectedStories.add(existing.story_id);
    return "handled";
  }
  const resultVersion = await client.query<VersionRow>(
    `UPDATE news_stories SET version = version + 1,
       first_published_at = CASE WHEN $3::timestamptz IS NULL THEN first_published_at
         ELSE LEAST(COALESCE(first_published_at, $3), $3) END,
       latest_published_at = CASE WHEN $3::timestamptz IS NULL THEN latest_published_at
         ELSE GREATEST(COALESCE(latest_published_at, $3), $3) END,
       updated_at = $2
     WHERE id = $1 RETURNING version`,
    [existing.story_id, collectedAt, publishedAtBackfill],
  );
  const version = storyVersion(resultVersion.rows[0]);
  await client.query(
    `UPDATE news_articles SET title = $2, summary = $3,
       published_at = COALESCE(published_at, $4), content_hash = $5, last_seen_at = $6
     WHERE id = $1`,
    [existing.id, value.article.title, value.article.summary, value.publishedAt,
      value.contentHash, collectedAt],
  );
  if (publishedAtBackfill) {
    await client.query(
      `UPDATE news_story_events SET anchor_published_at = COALESCE(anchor_published_at, $2)
       WHERE id = $1 AND anchor_article_id = $3`,
      [existing.event_id, publishedAtBackfill, existing.id],
    );
  }
  if (contentChanged) await insertRevision(client, value, version, collectedAt);
  affectedStories.add(existing.story_id);
  return "handled";
}

export async function insertStoryEvent(
  client: PoolClient,
  storyId: string,
  eventId: string,
  value: PersistableNewsArticle,
): Promise<void> {
  const { article, activityAt, publishedAt } = value;
  await client.query(
    `INSERT INTO news_story_events (
      id, story_id, anchor_article_id, anchor_title, anchor_summary, anchor_source,
      anchor_published_at, first_activity_at, last_activity_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [eventId, storyId, article.id, article.title, article.summary, article.source,
      publishedAt, activityAt],
  );
}

export async function createNewsStory(
  client: PoolClient,
  value: PersistableNewsArticle,
  collectedAt: Date,
): Promise<{ storyId: string; eventId: string; version: number }> {
  const storyId = randomUUID();
  const eventId = randomUUID();
  const { article, activityAt, publishedAt } = value;
  await client.query(
    `INSERT INTO news_stories (
      id, category, version, article_count, event_count, latest_article_id,
      first_published_at, latest_published_at, first_activity_at, last_activity_at,
      created_at, updated_at
    ) VALUES ($1,$2,1,1,1,$3,$4,$4,$5,$5,$6,$6)`,
    [storyId, article.category, article.id, publishedAt, activityAt, collectedAt],
  );
  await insertStoryEvent(client, storyId, eventId, value);
  return { storyId, eventId, version: 1 };
}

export async function advanceNewsStory(
  client: PoolClient,
  storyId: string,
  value: PersistableNewsArticle,
  createsEvent: boolean,
  collectedAt: Date,
): Promise<number> {
  const { article, activityAt, publishedAt } = value;
  const result = await client.query<VersionRow>(
    `UPDATE news_stories SET version = version + 1,
      article_count = article_count + 1, event_count = event_count + $3,
      latest_article_id = CASE
        WHEN $4 > last_activity_at OR ($4 = last_activity_at AND $5 < latest_article_id)
          THEN $5 ELSE latest_article_id END,
      first_published_at = CASE WHEN $6::timestamptz IS NULL THEN first_published_at
        ELSE LEAST(COALESCE(first_published_at, $6), $6) END,
      latest_published_at = CASE WHEN $6::timestamptz IS NULL THEN latest_published_at
        ELSE GREATEST(COALESCE(latest_published_at, $6), $6) END,
      first_activity_at = LEAST(first_activity_at, $4),
      last_activity_at = GREATEST(last_activity_at, $4), updated_at = $2
     WHERE id = $1 RETURNING version`,
    [storyId, collectedAt, createsEvent ? 1 : 0, activityAt, article.id, publishedAt],
  );
  return storyVersion(result.rows[0]);
}

export async function insertStoryArticle(
  client: PoolClient,
  value: PersistableNewsArticle,
  assignment: {
    storyId: string; eventId: string; version: number; kind: NewsStoryMatchKind;
    score: number; reasons: NewsStoryMatchReason[]; matchedArticleId: string | null;
  },
  collectedAt: Date,
): Promise<void> {
  const { article, activityAt, contentHash, publishedAt } = value;
  await client.query(
    `INSERT INTO news_articles (
      id, story_id, event_id, link, source, category, title, summary, published_at,
      activity_at, first_seen_at, last_seen_at, content_hash, added_version,
      match_kind, match_score, match_reasons, matched_article_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14,$15,$16::jsonb,$17)`,
    [article.id, assignment.storyId, assignment.eventId, article.link, article.source,
      article.category, article.title, article.summary, publishedAt, activityAt,
      collectedAt, contentHash, assignment.version, assignment.kind, assignment.score,
      JSON.stringify(assignment.reasons), assignment.matchedArticleId],
  );
  await insertRevision(client, value, assignment.version, collectedAt);
}
