import assert from "node:assert/strict";
import test from "node:test";

import {
  persistableNewsArticle,
  strictCoverageScore,
} from "../features/news/server/news-story-ingestion-model.server.ts";
import type { NewsArticle, NewsSource } from "../lib/types.ts";

const collectedAt = new Date("2026-08-26T12:00:00.000Z");

function article(
  id: string,
  source: NewsSource = "ERR",
  title = "Tallinn avab homme uue trammiliini",
): NewsArticle {
  return {
    id,
    title,
    link: `https://example.com/${id}`,
    summary: "Linn avab kesklinna ja sadamat ühendava liini.",
    publishedAt: "2026-08-26T11:30:00.000Z",
    category: "Eesti",
    source,
  };
}

test("bounds persisted feed fields and hashes only revision content", () => {
  const first = persistableNewsArticle(article("first"), collectedAt);
  const sameContent = persistableNewsArticle({
    ...article("second"),
    link: "https://example.com/elsewhere",
  }, collectedAt);
  const revised = persistableNewsArticle({
    ...article("first"),
    summary: "Uuendatud kirjeldus.",
  }, collectedAt);

  assert.ok(first);
  assert.ok(sameContent);
  assert.ok(revised);
  assert.equal(first.contentHash, sameContent.contentHash);
  assert.notEqual(first.contentHash, revised.contentHash);
  assert.match(first.contentHash, /^[0-9a-f]{64}$/u);
  assert.equal(persistableNewsArticle({ ...article("x"), title: " " }, collectedAt), null);
  assert.equal(
    persistableNewsArticle({ ...article("x"), summary: "x".repeat(2_001) }, collectedAt),
    null,
  );
});

test("uses collection time for missing, invalid, or excessively future dates", () => {
  for (const publishedAt of [null, "invalid", "2026-08-26T12:05:00.001Z"]) {
    const value = persistableNewsArticle({ ...article(String(publishedAt)), publishedAt }, collectedAt);
    assert.ok(value);
    assert.equal(value.publishedAt, null);
    assert.equal(value.activityAt.toISOString(), collectedAt.toISOString());
  }

  const tolerated = persistableNewsArticle({
    ...article("future-boundary"),
    publishedAt: "2026-08-26T12:05:00.000Z",
  }, collectedAt);
  assert.equal(tolerated?.publishedAt?.toISOString(), "2026-08-26T12:05:00.000Z");
});

test("strict coverage preserves the existing cross-source duplicate rules", () => {
  const anchor = article("anchor", "ERR");
  const matching = article("matching", "Postimees");

  assert.equal(strictCoverageScore(matching, anchor, collectedAt), 1);
  assert.equal(strictCoverageScore(article("same-copy", "ERR"), anchor, collectedAt), 1);
  assert.equal(strictCoverageScore({
    ...article("same-copy-other-category", "ERR"),
    category: "Majandus",
  }, anchor, collectedAt), 1);
  assert.equal(strictCoverageScore({
    ...article("expired-copy", "ERR"),
    publishedAt: "2026-08-23T11:59:59.999Z",
  }, anchor, collectedAt), null);
  assert.equal(strictCoverageScore({
    ...article("same-source-update", "ERR"),
    title: "Tallinna trammiliin alustas liiklust",
  }, anchor, collectedAt), null);
  assert.equal(strictCoverageScore({
    ...article("cross-category", "Postimees"),
    category: "Majandus",
  }, anchor, collectedAt), null);
  assert.equal(strictCoverageScore({
    ...matching,
    title: "Tallinn avab tänavu 13 uut rattateed",
  }, {
    ...anchor,
    title: "Tallinn avab tänavu 12 uut rattateed",
  }, collectedAt), null);
});
