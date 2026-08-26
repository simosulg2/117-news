import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateNewsCollector,
  newsCollectorPublicResult,
} from "../features/news/server/news-collector-policy.ts";

const TOKEN = "a".repeat(64);

test("authenticates only the exact configured news collector token", () => {
  assert.equal(authenticateNewsCollector(`Bearer ${TOKEN}`, TOKEN), "authorized");
  assert.equal(authenticateNewsCollector(`bearer ${TOKEN}`, TOKEN), "authorized");
  assert.equal(authenticateNewsCollector(`Bearer ${"A".repeat(64)}`, TOKEN), "unauthorized");
  assert.equal(authenticateNewsCollector(`Bearer ${TOKEN} extra`, TOKEN), "unauthorized");
  assert.equal(authenticateNewsCollector(`Basic ${TOKEN}`, TOKEN), "unauthorized");
  assert.equal(authenticateNewsCollector(null, TOKEN), "unauthorized");
});

test("rejects unsafe news collector token configuration", () => {
  assert.equal(authenticateNewsCollector(`Bearer ${TOKEN}`, undefined), "unconfigured");
  assert.equal(authenticateNewsCollector(`Bearer ${TOKEN}`, ""), "unconfigured");
  assert.equal(authenticateNewsCollector(`Bearer ${TOKEN}`, "too-short"), "unconfigured");
  assert.equal(
    authenticateNewsCollector(`Bearer ${TOKEN}`, `${"a".repeat(32)} token`),
    "unconfigured",
  );
  assert.equal(authenticateNewsCollector(`Bearer ${TOKEN}`, "a".repeat(513)), "unconfigured");
  assert.equal(authenticateNewsCollector(`Bearer ${"a".repeat(513)}`, TOKEN), "unauthorized");
});

test("maps news collector errors to fixed secret-free public results", () => {
  assert.deepEqual(newsCollectorPublicResult("unauthorized"), {
    status: 401,
    body: { ok: false, code: "unauthorized" },
  });
  assert.deepEqual(newsCollectorPublicResult("no_sources_available"), {
    status: 502,
    body: { ok: false, code: "no_sources_available" },
  });
  assert.deepEqual(newsCollectorPublicResult("news_store_unavailable"), {
    status: 503,
    body: { ok: false, code: "news_store_unavailable" },
  });
  assert.doesNotMatch(
    JSON.stringify(newsCollectorPublicResult("news_store_unavailable")),
    /secret|postgres|password/i,
  );
});

test("bounds and normalizes successful collector metadata", () => {
  assert.deepEqual(newsCollectorPublicResult("saved", {
    collectedAt: "2026-08-26T10:12:34+03:00",
    storedArticles: 23.9,
    affectedStories: Number.POSITIVE_INFINITY,
    sourcesLoaded: 4,
    sourcesTotal: 5,
  }), {
    status: 200,
    body: {
      ok: true,
      collectedAt: "2026-08-26T07:12:34.000Z",
      storedArticles: 23,
      affectedStories: 0,
      sources: { loaded: 4, total: 5, partial: true },
    },
  });

  const serialized = JSON.stringify(newsCollectorPublicResult("saved", {
    collectedAt: "postgresql://user:secret@database/private",
    storedArticles: -3,
    affectedStories: 50_000,
    sourcesLoaded: 8,
    sourcesTotal: 2,
  }));
  assert.doesNotMatch(serialized, /secret|postgres|password/i);
  assert.deepEqual(JSON.parse(serialized), {
    status: 200,
    body: {
      ok: true,
      collectedAt: "",
      storedArticles: 0,
      affectedStories: 10_000,
      sources: { loaded: 8, total: 8, partial: false },
    },
  });
});
