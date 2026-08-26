import assert from "node:assert/strict";
import test from "node:test";

import {
  filterNewsItems,
  newsRowId,
  newsStoryPreviews,
  nextNewsItemIndex,
  normalizeNewsSearch,
  orderedNewsStoryArticles,
  orderedNewsStoryEvents,
  relativeNewsTime,
} from "../features/news/model/news-items.ts";
import {
  parseReadTimestamps,
  pruneReadTimestamps,
  READ_STORAGE_KEY,
  READ_RETENTION_MS,
  readKeyForItem,
} from "../features/news/model/read-history.ts";
import {
  MAX_STORY_VISITS,
  parseStoryVisits,
  pruneStoryVisits,
  recordStoryVisits,
  STORY_VISITS_STORAGE_KEY,
  STORY_VISIT_RETENTION_MS,
  storyArticleIsNew,
  storyChangedSinceVisit,
} from "../features/news/model/story-visits.ts";
import type {
  FeedCategory,
  NewsArticle,
  NewsItem,
  NewsResponse,
  NewsStoryArticle,
  NewsStoryEvent,
  NewsStoryPreview,
} from "../lib/types.ts";

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
  return { ...article(id, title, category), related, story: null };
}

function response(items: NewsItem[], itemsByCategory?: NewsResponse["itemsByCategory"]): NewsResponse {
  return {
    items,
    itemsByCategory,
    updatedAt: "2026-08-13T10:00:00.000Z",
    storyHistory: {
      mode: "snapshot",
      activeWindowHours: 72,
      retentionDays: null,
      storedFallback: false,
    },
    sources: { loaded: 5, total: 5, failed: [], failures: [] },
  };
}

function story(id: string, version = 1, latestArticleId = `${id}-latest`): NewsStoryPreview {
  return {
    id,
    articleCount: version,
    eventCount: version,
    firstPublishedAt: "2026-08-13T08:00:00.000Z",
    latestPublishedAt: "2026-08-13T09:00:00.000Z",
    latestArticleId,
    version,
  };
}

function storyArticle(
  id: string,
  publishedAt: string | null,
  firstSeenAt = "2026-08-13T09:00:00.000Z",
): NewsStoryArticle {
  return {
    ...article(id, id, "Eesti", { publishedAt }),
    coverageId: `coverage-${id}`,
    addedVersion: 1,
    firstSeenAt,
    revisionCount: 1,
    association: { kind: "seed", score: 1, reasons: ["new_story"] },
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

test("news rows use stable story identities and collect previews across category views", () => {
  const persistent = { ...item("article", "Lugu", "Eesti"), story: story("stable", 2) };
  const newerCategoryCopy = { ...persistent, story: story("stable", 3) };
  const snapshot = item("snapshot", "Hetkepilt", "Sport");
  const data = response([persistent, snapshot], {
    Eesti: [newerCategoryCopy],
    Majandus: [],
    Sport: [snapshot],
  });

  assert.equal(newsRowId(persistent), "story:stable");
  assert.equal(newsRowId(snapshot), "article:snapshot");
  assert.deepEqual(newsStoryPreviews(data).map(({ id, version }) => [id, version]), [["stable", 3]]);
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

test("story visits are separate, bounded, and pruned after 30 days", () => {
  const now = Date.UTC(2026, 7, 13);
  const recent = now - 1_000;
  const old = now - STORY_VISIT_RETENTION_MS - 1;
  const parsed = parseStoryVisits(JSON.stringify({
    schemaVersion: 1,
    lastVisitAt: now,
    stories: {
      recent: { storyVersion: 2, latestArticleId: "article-2", seenAt: recent },
      old: { storyVersion: 1, latestArticleId: "article-1", seenAt: old },
      invalid: { storyVersion: -1, latestArticleId: "", seenAt: now },
    },
  }), now);

  assert.notEqual(STORY_VISITS_STORAGE_KEY, READ_STORAGE_KEY);
  assert.deepEqual(parsed?.stories, {
    recent: { storyVersion: 2, latestArticleId: "article-2", seenAt: recent },
  });
  assert.equal(parseStoryVisits("not-json", now), null);

  const manyStories = Object.fromEntries(Array.from({ length: MAX_STORY_VISITS + 5 }, (_, index) => [
    `story-${index}`,
    { storyVersion: 1, latestArticleId: `article-${index}`, seenAt: now - index },
  ]));
  const pruned = pruneStoryVisits({ schemaVersion: 1, lastVisitAt: now, stories: manyStories }, now);
  assert.equal(Object.keys(pruned?.stories ?? {}).length, MAX_STORY_VISITS);
});

test("story visit versions identify new stories, updates, and timeline articles", () => {
  const now = Date.UTC(2026, 7, 13);
  const initial = story("story", 2, "article-2");
  const envelope = recordStoryVisits(null, [initial], now);
  const visit = envelope.stories.story;

  assert.equal(storyChangedSinceVisit(initial, visit), false);
  assert.equal(storyChangedSinceVisit(story("story", 3, "article-3"), visit), true);
  assert.equal(storyChangedSinceVisit(story("story", 2, "replacement"), visit), true);
  assert.equal(storyChangedSinceVisit(story("story", 1, "article-1"), visit), false);
  assert.equal(storyChangedSinceVisit(story("new"), undefined), true);
  assert.equal(storyArticleIsNew(2, visit), false);
  assert.equal(storyArticleIsNew(3, visit), true);
  assert.equal(storyArticleIsNew(1, undefined), true);
});

test("story timelines sort events and coverage oldest to newest with undated entries last", () => {
  const early = storyArticle("early", "2026-08-13T08:00:00.000Z");
  const late = storyArticle("late", "2026-08-13T10:00:00.000Z");
  const undated = storyArticle("undated", null, "invalid");
  const events: NewsStoryEvent[] = [
    { id: "undated", publishedAt: null, articles: [undated] },
    { id: "late", publishedAt: "2026-08-13T10:00:00.000Z", articles: [late, early] },
    { id: "early", publishedAt: "2026-08-13T08:00:00.000Z", articles: [early] },
  ];

  assert.deepEqual(orderedNewsStoryEvents(events).map(({ id }) => id), ["early", "late", "undated"]);
  assert.deepEqual(orderedNewsStoryArticles([late, undated, early]).map(({ id }) => id), ["early", "late", "undated"]);
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
