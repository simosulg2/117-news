import assert from "node:assert/strict";
import test from "node:test";

import {
  groupNewsItems,
  hasSharedMeaningfulAnchor,
  normalizeStoryTitle,
  storyTitleSimilarity,
} from "../lib/group-stories.ts";
import type { NewsArticle, NewsSource } from "../lib/types.ts";

const now = new Date("2026-08-11T12:00:00.000Z");

function article(
  id: string,
  title: string,
  source: NewsSource,
  minutesAgo: number | null,
): NewsArticle {
  const hostname = source === "ERR"
    ? "err.ee"
    : source === "Postimees"
      ? "postimees.ee"
      : "lounapostimees.postimees.ee";

  return {
    id,
    title,
    source,
    link: `https://${hostname}/${id}`,
    summary: "",
    category: "Eesti",
    publishedAt: minutesAgo === null
      ? null
      : new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
  };
}

test("normalizes stacked editorial labels before scoring", () => {
  const labelled = "OTSE | VIDEO: Tallinn avab homme uue trammiliini";
  const plain = "Tallinn avab homme uue trammiliini";

  assert.equal(normalizeStoryTitle(labelled), normalizeStoryTitle(plain));
  assert.equal(storyTitleSimilarity(labelled, plain), 1);
});

test("groups recent matching titles across sources under the newest primary", () => {
  const groups = groupNewsItems([
    article("pm", "Tallinn avab homme uue trammiliini", "Postimees", 20),
    article("err", "OTSE: Tallinn avab homme uue trammiliini", "ERR", 10),
    article("louna", "Tallinn avab homme täiesti uue trammiliini", "Lõuna PM", 30),
  ], now);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, "err");
  assert.deepEqual(groups[0].related.map((item) => item.id), ["pm", "louna"]);
});

test("keeps same-source follow-ups as separate rows", () => {
  const groups = groupNewsItems([
    article("err-1", "Tallinn avab homme uue trammiliini", "ERR", 10),
    article("err-2", "Tallinn avab homme uue trammiliini", "ERR", 20),
  ], now);

  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.related.length === 0));
});

test("allows at most one related article per source", () => {
  const groups = groupNewsItems([
    article("err", "Tallinn avab homme uue trammiliini", "ERR", 10),
    article("pm-1", "Tallinn avab homme uue trammiliini", "Postimees", 20),
    article("pm-2", "VIDEO: Tallinn avab homme uue trammiliini", "Postimees", 30),
  ], now);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].related.length, 1);
  assert.equal(groups[0].related[0].source, "Postimees");
});

test("does not fuzzy-group old or undated stories", () => {
  const groups = groupNewsItems([
    article("recent", "Tallinn avab homme uue trammiliini", "ERR", 10),
    article("old", "Tallinn avab homme uue trammiliini", "Postimees", 24 * 60 + 1),
    article("undated", "Tallinn avab homme uue trammiliini", "Lõuna PM", null),
  ], now);

  assert.equal(groups.length, 3);
  assert.ok(groups.every((group) => group.related.length === 0));
});

test("requires a substantive shared anchor even for very similar generic titles", () => {
  assert.equal(hasSharedMeaningfulAnchor("Täna tuleb uus uudis", "Täna tuleb uus uudis"), false);

  const groups = groupNewsItems([
    article("err", "Täna tuleb uus uudis", "ERR", 10),
    article("pm", "Täna tuleb uus uudis", "Postimees", 20),
  ], now);

  assert.equal(groups.length, 2);
});

test("does not join a third story through a merely transitive match", () => {
  const groups = groupNewsItems([
    article("a", "Tallinn avab homme uue kiire trammiliini kesklinna elanikele", "ERR", 10),
    article(
      "b",
      "Tallinn avab homme uue kiire trammiliini kesklinna elanikele Pärnu bussiliini",
      "Postimees",
      20,
    ),
    article(
      "c",
      "Homme uue kiire trammiliini kesklinna elanikele Pärnu bussiliini",
      "Lõuna PM",
      30,
    ),
  ], now);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].related.map((item) => item.id), ["b"]);
  assert.equal(groups[1].id, "c");
});

test("does not merge otherwise-similar headlines with conflicting numbers", () => {
  const groups = groupNewsItems([
    article("err", "Tallinn avab tänavu 12 uut rattateed", "ERR", 10),
    article("pm", "Tallinn avab tänavu 13 uut rattateed", "Postimees", 20),
  ], now);

  assert.equal(groups.length, 2);
});

test("keeps similarly phrased but substantively different openings separate", () => {
  const groups = groupNewsItems([
    article("err", "Tallinn avab uue kooli Lasnamäel", "ERR", 10),
    article("pm", "Tallinn avab uue lasteaia Lasnamäel", "Postimees", 20),
  ], now);

  assert.equal(groups.length, 2);
});
