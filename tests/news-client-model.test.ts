import assert from "node:assert/strict";
import test from "node:test";

import {
  filterNewsItems,
  nextNewsItemIndex,
  normalizeNewsSearch,
  relativeNewsTime,
} from "../features/news/model/news-items.ts";
import {
  parseReadTimestamps,
  pruneReadTimestamps,
  READ_RETENTION_MS,
  readKeyForItem,
} from "../features/news/model/read-history.ts";
import type { FeedCategory, NewsArticle, NewsItem, NewsResponse } from "../lib/types.ts";

function article(
  id: string,
  title: string,
  category: FeedCategory,
  overrides: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    id,
    title,
    link: `https://example.com/${id}`,
    summary: "",
    publishedAt: "2026-08-13T09:00:00.000Z",
    category,
    source: "ERR",
    ...overrides,
  };
}

function item(
  id: string,
  title: string,
  category: FeedCategory,
  related: NewsArticle[] = [],
): NewsItem {
  return { ...article(id, title, category), related };
}

function response(items: NewsItem[], itemsByCategory?: NewsResponse["itemsByCategory"]): NewsResponse {
  return {
    items,
    itemsByCategory,
    updatedAt: "2026-08-13T10:00:00.000Z",
    sources: { loaded: 5, total: 5, failed: [], failures: [] },
  };
}

test("news search is Estonian case- and accent-insensitive", () => {
  assert.equal(normalizeNewsSearch("ÕUN ÄRI"), "oun ari");
});

test("news filtering searches primary and related article text", () => {
  const sport = item("sport", "Võistlus lõppes", "Sport", [
    article("related", "Ülevaade Pärnust", "Sport", { source: "Postimees" }),
  ]);
  const economy = item("economy", "Majandus kasvab", "Majandus");
  const data = response([sport, economy]);

  assert.deepEqual(filterNewsItems(data, "Kõik", "parnust").map(({ id }) => id), ["sport"]);
  assert.deepEqual(filterNewsItems(data, "Majandus", "").map(({ id }) => id), ["economy"]);
  assert.deepEqual(filterNewsItems(data, "Sport", "majandus"), []);
});

test("category filtering honors a precomputed category collection", () => {
  const primary = item("primary", "Esimene", "Eesti");
  const categoryItem = item("category", "Teine", "Eesti");
  const data = response([primary], {
    Eesti: [categoryItem],
    Majandus: [],
    Sport: [],
  });

  assert.deepEqual(filterNewsItems(data, "Eesti", "").map(({ id }) => id), ["category"]);
});

test("read keys ignore URL fragments and fall back safely", () => {
  assert.equal(
    readKeyForItem(article("one", "One", "Eesti", { link: "https://example.com/story#section" })),
    "url:https://example.com/story",
  );
  assert.equal(readKeyForItem(article("two", "Two", "Eesti", { link: "  " })), "id:two");
  assert.equal(readKeyForItem(article("three", "Three", "Eesti", { link: "not a url" })), "url:not a url");
});

test("read history retains only finite entries inside the 30-day window", () => {
  const now = Date.UTC(2026, 7, 13);
  const cutoff = now - READ_RETENTION_MS;
  assert.deepEqual(
    pruneReadTimestamps({ keep: cutoff, recent: now, old: cutoff - 1, invalid: Number.NaN, text: "1", "": now }, now),
    { keep: cutoff, recent: now },
  );
  assert.deepEqual(parseReadTimestamps("not-json", now), {});
  assert.deepEqual(parseReadTimestamps(JSON.stringify({ recent: now }), now), { recent: now });
});

test("keyboard navigation clamps at list boundaries", () => {
  assert.equal(nextNewsItemIndex("next", -1, 3), 0);
  assert.equal(nextNewsItemIndex("next", 2, 3), 2);
  assert.equal(nextNewsItemIndex("previous", -1, 3), 2);
  assert.equal(nextNewsItemIndex("previous", 0, 3), 0);
  assert.equal(nextNewsItemIndex("next", -1, 0), -1);
});

test("relative news time preserves current rounding and units", () => {
  const now = Date.UTC(2026, 7, 13, 12);
  assert.equal(relativeNewsTime(new Date(now - 20_000).toISOString(), now), "praegu");
  assert.equal(relativeNewsTime(new Date(now - 31 * 60_000).toISOString(), now), "31 min");
  assert.equal(relativeNewsTime(new Date(now - 2 * 60 * 60_000).toISOString(), now), "2 t");
  assert.equal(relativeNewsTime(new Date(now - 2 * 24 * 60 * 60_000).toISOString(), now), "2 p");
});
