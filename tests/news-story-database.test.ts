import assert from "node:assert/strict";
import test from "node:test";

import {
  newsStoryPoolConfig,
  safeNewsStoryDatabaseErrorDetails,
} from "../features/news/server/news-story-database.server.ts";
import {
  NEWS_STORY_SCHEMA_SQL,
  NEWS_STORY_SCHEMA_VERSION,
} from "../features/news/server/news-story-schema.server.ts";

test("bounds news story database connections and queries", () => {
  const config = newsStoryPoolConfig("postgresql://news:secret@database/news");

  assert.equal(config.connectionTimeoutMillis, 5_000);
  assert.equal(config.statement_timeout, 5_000);
  assert.equal(config.lock_timeout, 5_000);
  assert.equal(config.query_timeout, 5_000);
  assert.equal(config.idleTimeoutMillis, 30_000);
  assert.equal(config.max, 2);
});

test("database diagnostics omit messages, SQL, and malformed error fields", () => {
  const failure = Object.assign(
    new Error("postgresql://user:secret@database/private"),
    { code: "57014", detail: "password=secret" },
  );
  assert.deepEqual(safeNewsStoryDatabaseErrorDetails(failure), {
    name: "Error",
    code: "57014",
  });
  assert.deepEqual(
    safeNewsStoryDatabaseErrorDetails({ name: "secret leaked", code: "password=secret" }),
    { name: "UnknownError" },
  );
  assert.deepEqual(safeNewsStoryDatabaseErrorDetails("postgresql://secret"), {
    name: "UnknownError",
  });
});

test("news story schema is idempotent, bounded, and cascade-prunable", () => {
  assert.equal(NEWS_STORY_SCHEMA_VERSION, 1);
  for (const table of [
    "news_stories",
    "news_story_events",
    "news_articles",
    "news_article_revisions",
  ]) {
    assert.match(NEWS_STORY_SCHEMA_SQL, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(NEWS_STORY_SCHEMA_SQL, /ON DELETE CASCADE/g);
  assert.match(NEWS_STORY_SCHEMA_SQL, /match_score >= 0 AND match_score <= 1/);
  assert.match(NEWS_STORY_SCHEMA_SQL, /anchor_article_id TEXT NOT NULL/);
  assert.match(NEWS_STORY_SCHEMA_SQL, /anchor_title TEXT NOT NULL/);
  assert.match(NEWS_STORY_SCHEMA_SQL, /news_stories_retention_idx/);
  assert.match(NEWS_STORY_SCHEMA_SQL, /last_activity_at ASC, id/);
  assert.match(NEWS_STORY_SCHEMA_SQL, /octet_length\(match_reasons::TEXT\) <= 2048/);
  assert.doesNotMatch(NEWS_STORY_SCHEMA_SQL, /CREATE EXTENSION/i);
});
