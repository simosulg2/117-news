import assert from "node:assert/strict";
import test from "node:test";

import type { FeedDefinition } from "../features/news/server/feed-config.ts";
import {
  looksLikeFeedXml,
  plainFeedText,
  resolveFeedCategory,
  safeFeedDiagnosticText,
  shortenFeedText,
} from "../features/news/server/feed-content.ts";
import { feedCategoryText } from "../lib/feed-categories.ts";

const dynamicPostimeesFeed: FeedDefinition = {
  name: "Postimees",
  category: null,
  source: "Postimees",
  url: "https://www.postimees.ee/rss",
  allowedRoot: "postimees.ee",
};

test("reads category labels from both RSS string and XML object formats", () => {
  assert.equal(feedCategoryText(["Sport", "Kergejõustik"]), "Sport Kergejõustik");

  const sport = Object.assign(Object.create(null) as Record<string, unknown>, {
    _: "Sport",
    $: Object.assign(Object.create(null) as Record<string, unknown>, {
      domain: "https://sport.postimees.ee",
    }),
  });
  const athletics = Object.assign(Object.create(null) as Record<string, unknown>, {
    _: "Kergejõustik",
    $: Object.assign(Object.create(null) as Record<string, unknown>, {
      domain: "https://sport.postimees.ee/section/161",
    }),
  });
  assert.equal(
    feedCategoryText([sport, athletics]),
    "Sport Kergejõustik",
  );
});

test("ignores malformed category entries without coercing them", () => {
  const hostile = Object.create(null) as { toString?: () => string };
  hostile.toString = () => {
    throw new Error("must not be called");
  };

  assert.equal(feedCategoryText([null, 42, {}, hostile, { _: 123 }, { _: "Eesti" }]), "Eesti");
});

test("resolves dynamic feed categories from RSS labels and canonical links", () => {
  assert.equal(
    resolveFeedCategory(dynamicPostimeesFeed, { categories: ["Jalgpall"] }, "https://sport.postimees.ee/123"),
    "Sport",
  );
  assert.equal(
    resolveFeedCategory(dynamicPostimeesFeed, {}, "https://majandus.postimees.ee/investor-uudis"),
    "Majandus",
  );
  assert.equal(
    resolveFeedCategory(dynamicPostimeesFeed, {}, "https://www.postimees.ee/eesti/uudis"),
    "Eesti",
  );
});

test("a configured feed category takes precedence over feed metadata", () => {
  const fixedFeed: FeedDefinition = { ...dynamicPostimeesFeed, name: "ERR Eesti", source: "ERR", category: "Eesti" };
  assert.equal(
    resolveFeedCategory(fixedFeed, { categories: ["Sport"] }, "https://www.err.ee/majandus/investor"),
    "Eesti",
  );
});

test("feed text helpers preserve safe text while stripping markup and secrets", () => {
  assert.equal(
    plainFeedText("<script>ignore()</script><p>A &amp; B&nbsp;&mdash;&nbsp;&#xD5;</p>"),
    "A & B — Õ",
  );
  assert.equal(
    safeFeedDiagnosticText("password=hunter2 cookie:session token=abc"),
    "password=[redacted] cookie=[redacted] token=[redacted]",
  );
});

test("feed content detection accepts RSS variants and rejects HTML", () => {
  assert.equal(looksLikeFeedXml("\uFEFF  <?xml version=\"1.0\"?><rss version=\"2.0\">"), true);
  assert.equal(looksLikeFeedXml("<feed xmlns=\"http://www.w3.org/2005/Atom\">"), true);
  assert.equal(looksLikeFeedXml("<!doctype html><html><body>blocked</body></html>"), false);
  assert.equal(shortenFeedText("alpha beta gamma delta", 12), "alpha beta…");
});
