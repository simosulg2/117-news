import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import type { PersistableNewsArticle } from "../features/news/server/news-story-ingestion-model.server.ts";
import { updateKnownArticle } from "../features/news/server/news-story-write.server.ts";

type QueryCall = { text: string; values: unknown[] | undefined };

function persistable(publishedAt: Date): PersistableNewsArticle {
  return {
    article: {
      id: "article-1",
      title: "Tallinn avab uue trammiliini",
      link: "https://example.com/article-1",
      summary: "Kesklinna ja sadamat ühendav liin avatakse homme.",
      publishedAt: publishedAt.toISOString(),
      category: "Eesti",
      source: "ERR",
    },
    activityAt: publishedAt,
    contentHash: "a".repeat(64),
    publishedAt,
  };
}

test("known articles backfill publication time into article, event, and story metadata", async () => {
  const calls: QueryCall[] = [];
  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.includes("SELECT id, link")) {
        return {
          rows: [{
            id: "article-1",
            link: "https://example.com/article-1",
            story_id: "00000000-0000-0000-0000-000000000001",
            event_id: "00000000-0000-0000-0000-000000000002",
            content_hash: "a".repeat(64),
            published_at: null,
          }],
        };
      }
      if (text.includes("UPDATE news_stories")) return { rows: [{ version: 2 }] };
      return { rows: [] };
    },
  } as unknown as PoolClient;
  const collectedAt = new Date("2026-08-26T12:00:00.000Z");
  const publishedAt = new Date("2026-08-26T11:30:00.000Z");
  const affected = new Set<string>();

  assert.equal(
    await updateKnownArticle(client, persistable(publishedAt), collectedAt, affected),
    "handled",
  );
  assert.equal(calls.length, 4);
  assert.match(calls[1].text, /first_published_at/);
  assert.match(calls[1].text, /latest_published_at/);
  assert.equal(calls[1].values?.[2], publishedAt);
  assert.match(calls[2].text, /published_at = COALESCE/);
  assert.match(calls[3].text, /anchor_published_at = COALESCE/);
  assert.match(calls[3].text, /anchor_article_id = \$3/);
  assert.equal(calls[3].values?.[2], "article-1");
  assert.equal(calls.some(({ text }) => text.includes("news_article_revisions")), false);
  assert.deepEqual([...affected], ["00000000-0000-0000-0000-000000000001"]);
});

test("unchanged known articles with a publication time only refresh last-seen state", async () => {
  const calls: QueryCall[] = [];
  const publishedAt = new Date("2026-08-26T11:30:00.000Z");
  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.includes("SELECT id, link")) {
        return {
          rows: [{
            id: "article-1",
            link: "https://example.com/article-1",
            story_id: "00000000-0000-0000-0000-000000000001",
            event_id: "00000000-0000-0000-0000-000000000002",
            content_hash: "a".repeat(64),
            published_at: publishedAt,
          }],
        };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  assert.equal(
    await updateKnownArticle(client, persistable(publishedAt), new Date(), new Set()),
    "handled",
  );
  assert.equal(calls.length, 2);
  assert.match(calls[1].text, /last_seen_at/);
});
