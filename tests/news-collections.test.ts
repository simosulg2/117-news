import assert from "node:assert/strict";
import test from "node:test";

import { groupNewsItems } from "../lib/group-stories.ts";
import {
  buildNewsCollections,
  buildPersistentNewsCollections,
  MAX_NEWS_ITEMS,
  type NewsStoryAssociation,
} from "../lib/news-collections.ts";
import type { NewsStoryPreview } from "../lib/types.ts";
import type { FeedCategory, NewsArticle, NewsSource } from "../lib/types.ts";

const NOW = new Date("2026-08-12T12:00:00.000Z");

function article(
  id: string,
  category: FeedCategory,
  minutesAgo: number,
  source: NewsSource = "ERR",
  title = `Uudis ${id}`,
): NewsArticle {
  return {
    id,
    title,
    link: `https://example.com/${id}`,
    summary: "",
    publishedAt: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString(),
    category,
    source,
  };
}

test("caps the main list and every category at 117 grouped stories", () => {
  const categories: FeedCategory[] = ["Eesti", "Majandus", "Sport"];
  const articles = categories.flatMap((category, categoryIndex) =>
    Array.from({ length: 130 }, (_, index) =>
      article(`${category}-${index}`, category, categoryIndex * 1_000 + index),
    ),
  );

  const collections = buildNewsCollections(articles, NOW);

  assert.equal(collections.items.length, MAX_NEWS_ITEMS);
  assert.deepEqual(collections.items, groupNewsItems(articles, NOW).slice(0, MAX_NEWS_ITEMS));
  for (const category of categories) {
    assert.equal(collections.itemsByCategory[category].length, MAX_NEWS_ITEMS);
    assert.ok(collections.itemsByCategory[category].every((item) => item.category === category));
  }
});

test("keeps quiet-category stories that fall beyond the main cutoff", () => {
  const recentSport = Array.from({ length: MAX_NEWS_ITEMS }, (_, index) =>
    article(`sport-${index}`, "Sport", index),
  );
  const olderEstonia = Array.from({ length: 8 }, (_, index) =>
    article(`eesti-${index}`, "Eesti", 1_000 + index),
  );

  const collections = buildNewsCollections([...recentSport, ...olderEstonia], NOW);
  const flattenedMainIds = new Set(
    collections.items.flatMap((item) => [item, ...item.related]).map((item) => item.id),
  );

  assert.ok(collections.items.every((item) => item.category === "Sport"));
  assert.ok(olderEstonia.every((item) => !flattenedMainIds.has(item.id)));
  assert.equal(collections.itemsByCategory.Eesti.length, olderEstonia.length);
  assert.deepEqual(
    collections.itemsByCategory.Eesti.map((item) => item.id),
    olderEstonia.map((item) => item.id),
  );
});

test("groups only within each category and never mixes section categories", () => {
  const sharedTitle = "Tallinn avab uue ühenduse sadamaga";
  const articles = [
    article("eesti-err", "Eesti", 1, "ERR", sharedTitle),
    article("eesti-pm", "Eesti", 2, "Postimees", sharedTitle),
    article("majandus-pm", "Majandus", 3, "Lõuna PM", sharedTitle),
  ];

  const collections = buildNewsCollections(articles, NOW);
  const estonia = collections.itemsByCategory.Eesti;
  const economy = collections.itemsByCategory.Majandus;

  assert.equal(estonia.length, 1);
  assert.equal(estonia[0].related.length, 1);
  assert.ok([estonia[0], ...estonia[0].related].every((item) => item.category === "Eesti"));
  assert.equal(economy.length, 1);
  assert.ok([economy[0], ...economy[0].related].every((item) => item.category === "Majandus"));
});

test("groups category stories before applying the row limit", () => {
  const sharedTitle = "Tallinn avab uue ühenduse sadamaga";
  const articles = [
    article("new-err", "Eesti", 1, "ERR", sharedTitle),
    article("new-pm", "Eesti", 2, "Postimees", sharedTitle),
    article("older", "Eesti", 3, "Lõuna PM", "Riik avaldas uue haridusstrateegia"),
  ];

  const estonia = buildNewsCollections(articles, NOW, 2).itemsByCategory.Eesti;

  assert.equal(estonia.length, 2);
  assert.equal(estonia[0].id, "new-err");
  assert.deepEqual(estonia[0].related.map((item) => item.id), ["new-pm"]);
  assert.equal(estonia[1].id, "older");
});

test("returns every available story when a category has fewer than 117", () => {
  const articles = [
    article("old", "Majandus", 30),
    article("new", "Majandus", 5),
  ];

  const economy = buildNewsCollections(articles, NOW).itemsByCategory.Majandus;

  assert.deepEqual(economy.map((item) => item.id), ["new", "old"]);
});

test("returns all category keys for an empty article pool", () => {
  assert.deepEqual(buildNewsCollections([], NOW), {
    items: [],
    itemsByCategory: {
      Eesti: [],
      Majandus: [],
      Sport: [],
    },
  });
});

function story(id: string, articleCount: number, latestArticleId: string): NewsStoryPreview {
  return {
    id,
    articleCount,
    eventCount: 2,
    firstPublishedAt: "2026-08-12T09:00:00.000Z",
    latestPublishedAt: "2026-08-12T11:59:00.000Z",
    latestArticleId,
    version: articleCount,
  };
}

test("persistent collections collapse current articles under a stable story", () => {
  const first = article("first", "Eesti", 20, "ERR", "Tallinn avas uue trammiliini");
  const duplicate = article("duplicate", "Eesti", 19, "Postimees", "Tallinn avas uue trammiliini");
  const followUp = article("follow-up", "Eesti", 2, "ERR", "Tallinna uus trammiliin alustas liiklust");
  const preview = story("11111111-1111-4111-8111-111111111111", 3, followUp.id);
  const associations = new Map<string, NewsStoryAssociation>([
    [first.id, { coverageId: "event-a", story: preview }],
    [duplicate.id, { coverageId: "event-a", story: preview }],
    [followUp.id, { coverageId: "event-b", story: preview }],
  ]);

  const collections = buildPersistentNewsCollections(
    [first, duplicate, followUp],
    associations,
    NOW,
  );

  assert.equal(collections.items.length, 1);
  assert.equal(collections.items[0].id, followUp.id);
  assert.equal(collections.items[0].story?.id, preview.id);
  assert.deepEqual(collections.items[0].related, []);
});

test("persistent collections keep strict current-event coverage as fallback", () => {
  const primary = article("primary", "Eesti", 1, "ERR", "Tallinn avas uue trammiliini");
  const related = article("related", "Eesti", 2, "Postimees", "Tallinn avas uue trammiliini");
  const preview = story("22222222-2222-4222-8222-222222222222", 2, primary.id);
  const associations = new Map<string, NewsStoryAssociation>([
    [primary.id, { coverageId: "event", story: preview }],
    [related.id, { coverageId: "event", story: preview }],
  ]);

  const [item] = buildPersistentNewsCollections([related, primary], associations, NOW).items;

  assert.equal(item.id, primary.id);
  assert.deepEqual(item.related.map(({ id }) => id), [related.id]);
});

test("persistent collections retain legacy grouping for uncollected articles", () => {
  const articles = [
    article("err", "Eesti", 1, "ERR", "Tallinn avas uue trammiliini"),
    article("pm", "Eesti", 2, "Postimees", "Tallinn avas uue trammiliini"),
  ];

  const [item] = buildPersistentNewsCollections(articles, new Map(), NOW).items;

  assert.equal(item.story, null);
  assert.deepEqual(item.related.map(({ id }) => id), ["pm"]);
});
