import assert from "node:assert/strict";
import test from "node:test";

import {
  FeedLoadError,
  normalizeFeedRequestError,
  publicFeedFailure,
  withFeedRetry,
} from "../lib/feed-retry.ts";
import type { FeedFailureCode } from "../lib/types.ts";

test("retries timeout, network, 429, and 5xx failures once", async () => {
  const retryable = [
    new FeedLoadError("timeout", "timed out"),
    new FeedLoadError("network", "connection reset"),
    new FeedLoadError("http", "rate limited", 429),
    new FeedLoadError("http", "server error", 500),
    new FeedLoadError("http", "unavailable", 503),
  ];

  for (const failure of retryable) {
    let calls = 0;
    const result = await withFeedRetry(async () => {
      calls += 1;
      if (calls === 1) throw failure;
      return "ok";
    });

    assert.equal(result, "ok");
    assert.equal(calls, 2);
  }
});

test("stops after two attempts for a persistent retryable failure", async () => {
  let calls = 0;

  await assert.rejects(
    withFeedRetry(async () => {
      calls += 1;
      throw new FeedLoadError("network", "still unavailable");
    }),
    (error: unknown) => error instanceof FeedLoadError && error.code === "network",
  );
  assert.equal(calls, 2);
});

test("does not retry permanent HTTP or content failures", async () => {
  const permanentCodes: FeedFailureCode[] = [
    "configuration",
    "invalid_content",
    "no_valid_items",
    "parse",
    "redirect",
    "response_too_large",
    "unknown",
  ];
  const permanent = [
    ...permanentCodes.map((code) => new FeedLoadError(code, "permanent")),
    new FeedLoadError("http", "bad request", 400),
    new FeedLoadError("http", "forbidden", 403),
    new FeedLoadError("http", "not found", 404),
    new FeedLoadError("http", "request timeout", 408),
  ];

  for (const failure of permanent) {
    let calls = 0;
    await assert.rejects(withFeedRetry(async () => {
      calls += 1;
      throw failure;
    }));
    assert.equal(calls, 1);
  }
});

test("classifies raw errors as network failures only at request boundaries", async () => {
  const requestFailure = normalizeFeedRequestError(new TypeError("fetch failed"));
  assert.equal(requestFailure.code, "network");
  assert.equal(normalizeFeedRequestError(new DOMException("timed out", "TimeoutError")).code, "timeout");

  let calls = 0;
  await assert.rejects(
    withFeedRetry(async () => {
      calls += 1;
      throw new TypeError("application conversion failed");
    }),
    (error: unknown) => error instanceof FeedLoadError && error.code === "unknown",
  );
  assert.equal(calls, 1);
});

test("public feed failures contain only safe structured fields", () => {
  const failure = publicFeedFailure(
    "Postimees",
    new FeedLoadError("http", "bodyPrefix=secret=do-not-expose; requestId=private", 403),
  );

  assert.deepEqual(failure, { name: "Postimees", code: "http", status: 403 });
  assert.equal(JSON.stringify(failure).includes("do-not-expose"), false);
  assert.equal(JSON.stringify(failure).includes("requestId"), false);
});
