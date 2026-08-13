import assert from "node:assert/strict";
import test from "node:test";

import {
  readBoundedResponseText,
  ResponseSizeLimitError,
} from "../lib/bounded-response.ts";

test("bounded reader rejects an oversized chunk before buffering the response", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("1234"));
      controller.enqueue(new TextEncoder().encode("5678"));
    },
    cancel() {
      cancelled = true;
    },
  }));

  await assert.rejects(
    () => readBoundedResponseText(response, 7),
    ResponseSizeLimitError,
  );
  assert.equal(cancelled, true);
});

test("bounded reader preserves its size error when stream cancellation fails", async () => {
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("too large"));
    },
    cancel() {
      throw new Error("cancel failed");
    },
  }));

  await assert.rejects(
    () => readBoundedResponseText(response, 4),
    ResponseSizeLimitError,
  );
});

test("bounded reader rejects a declared oversized body without pulling it", async () => {
  let pulled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull() {
      pulled = true;
    },
  }), { headers: { "Content-Length": "101" } });

  await assert.rejects(
    () => readBoundedResponseText(response, 100),
    ResponseSizeLimitError,
  );
  assert.equal(pulled, false);
});
