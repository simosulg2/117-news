import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedFeedRequestUrl,
  canonicalArticleLink,
  resolveArticleLink,
} from "../lib/feed-links.ts";

const lounaFeedUrl = "https://lounapostimees.postimees.ee/rss";

test("accepts exact pmo.ee article links only for Postimees feeds", () => {
  assert.equal(
    canonicalArticleLink("https://pmo.ee/8525629?utm_source=rss#story", "postimees.ee"),
    "https://pmo.ee/8525629",
  );
  assert.equal(canonicalArticleLink("https://pmo.ee/8525629", "err.ee"), null);
  assert.equal(canonicalArticleLink("https://subdomain.pmo.ee/8525629", "postimees.ee"), null);
  assert.equal(canonicalArticleLink("https://pmo.ee.evil.test/8525629", "postimees.ee"), null);
});

test("converts only validated Postimees GUIDs without resolving opaque GUIDs", () => {
  assert.equal(
    resolveArticleLink(undefined, "pm#8525629", "postimees.ee", lounaFeedUrl),
    "https://pmo.ee/8525629",
  );
  assert.equal(resolveArticleLink(undefined, "pm#not-digits", "postimees.ee", lounaFeedUrl), null);
  assert.equal(resolveArticleLink(undefined, "pm#8525629/extra", "postimees.ee", lounaFeedUrl), null);
  assert.equal(resolveArticleLink(undefined, "story#8525629", "postimees.ee", lounaFeedUrl), null);
  assert.equal(resolveArticleLink(undefined, "pm#8525629", "err.ee", "https://www.err.ee/rss/eesti"), null);
  assert.equal(
    resolveArticleLink("   ", "pm#8525629", "postimees.ee", lounaFeedUrl),
    "https://pmo.ee/8525629",
  );
});

test("keeps a full Postimees feed as distinct article links", () => {
  const links = Array.from({ length: 25 }, (_, index) => {
    const id = String(8_525_600 + index);
    return resolveArticleLink(`https://pmo.ee/${id}`, `pm#${id}`, "postimees.ee", lounaFeedUrl);
  });

  assert.ok(links.every((link): link is string => link !== null));
  assert.equal(new Set(links).size, 25);
  assert.ok(links.every((link) => new URL(link).pathname !== "/pm"));
});

test("keeps feed requests on approved HTTPS hosts", () => {
  assert.equal(
    allowedFeedRequestUrl("https://www.postimees.ee/rss", "postimees.ee")?.toString(),
    "https://www.postimees.ee/rss",
  );
  assert.equal(
    allowedFeedRequestUrl("/next", "postimees.ee", "https://www.postimees.ee/rss")?.toString(),
    "https://www.postimees.ee/next",
  );
  assert.equal(allowedFeedRequestUrl("http://www.postimees.ee/rss", "postimees.ee"), null);
  assert.equal(allowedFeedRequestUrl("https://pmo.ee/8525629", "postimees.ee"), null);
  assert.equal(allowedFeedRequestUrl("https://postimees.ee.evil.test/rss", "postimees.ee"), null);
  assert.equal(allowedFeedRequestUrl("https://user:secret@www.postimees.ee/rss", "postimees.ee"), null);
  assert.equal(allowedFeedRequestUrl("https://www.postimees.ee:8443/rss", "postimees.ee"), null);
});
