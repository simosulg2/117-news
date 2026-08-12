import assert from "node:assert/strict";
import test from "node:test";

import {
  ratingsContentTypeMayContainJson,
  RatingsResponseReadError,
  readBoundedResponseText,
} from "../lib/ratings-response.ts";

test("accepts JSON, structured JSON, and common generic static-file MIME types", () => {
  for (const contentType of [
    null,
    "",
    "application/json",
    "Application/JSON; Charset=UTF-8",
    "application/vnd.ratings+json; version=3",
    "application/octet-stream",
    "application/binary",
    "binary/octet-stream",
    "text/json",
    "text/plain; charset=utf-8",
  ]) {
    assert.equal(ratingsContentTypeMayContainJson(contentType), true, String(contentType));
  }
});

test("rejects content types that do not represent JSON or a generic static file", () => {
  for (const contentType of ["text/html", "application/xml", "image/png", "text/css"]) {
    assert.equal(ratingsContentTypeMayContainJson(contentType), false, contentType);
  }
});

test("reads a chunked UTF-8 response up to the exact byte limit", async () => {
  const chunks = [new TextEncoder().encode("Tere, "), new TextEncoder().encode("Eesti!")];
  const response = new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
  }));

  assert.equal(await readBoundedResponseText(response, 12), "Tere, Eesti!");
});

test("stops a chunked response as soon as it crosses the byte limit", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(4));
      controller.enqueue(new Uint8Array(4));
    },
    cancel() {
      cancelled = true;
    },
  }));

  await assert.rejects(
    readBoundedResponseText(response, 7),
    RatingsResponseReadError,
  );
  assert.equal(cancelled, true);
});

test("rejects an oversized declared Content-Length before reading", async () => {
  let pulled = false;
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull() {
      pulled = true;
    },
    cancel() {
      cancelled = true;
    },
  }), {
    headers: { "Content-Length": "101" },
  });

  await assert.rejects(
    readBoundedResponseText(response, 100),
    RatingsResponseReadError,
  );
  assert.equal(pulled, false);
  assert.equal(cancelled, true);
});

test("validates the configured byte limit", async () => {
  for (const maximumBytes of [-1, 1.5, Number.MAX_VALUE]) {
    await assert.rejects(
      readBoundedResponseText(new Response("{}"), maximumBytes),
      RangeError,
    );
  }
});
