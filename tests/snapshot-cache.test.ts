import assert from "node:assert/strict";
import test from "node:test";

import { InProcessSnapshotCache } from "../lib/snapshot-cache.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("reuses a snapshot for its TTL and refreshes after expiry", async () => {
  let now = 0;
  let refreshes = 0;
  const cache = new InProcessSnapshotCache(300_000, 30_000, () => now);
  const refresh = async () => ({ version: ++refreshes });

  const initial = await cache.get(refresh);
  assert.deepEqual(initial, { status: "miss", value: { version: 1 } });

  now = 299_999;
  const hit = await cache.get(refresh);
  assert.deepEqual(hit, { status: "hit", value: { version: 1 } });
  assert.equal(refreshes, 1);

  now = 300_000;
  const refreshed = await cache.get(refresh);
  assert.deepEqual(refreshed, { status: "refreshed", value: { version: 2 } });
  assert.equal(refreshes, 2);
});

test("waits for and shares one expired-snapshot refresh", async () => {
  let now = 0;
  let refreshes = 0;
  const cache = new InProcessSnapshotCache(300_000, 30_000, () => now);
  await cache.get(async () => ({ version: ++refreshes }));

  now = 300_000;
  const gate = deferred<{ version: number }>();
  const refresh = () => {
    refreshes += 1;
    return gate.promise;
  };
  let firstSettled = false;
  const first = cache.get(refresh).then((result) => {
    firstSettled = true;
    return result;
  });
  const second = cache.get(refresh);

  await Promise.resolve();
  assert.equal(refreshes, 2);
  assert.equal(firstSettled, false);

  gate.resolve({ version: 2 });
  const results = await Promise.all([first, second]);
  assert.deepEqual(results, [
    { status: "refreshed", value: { version: 2 } },
    { status: "refreshed", value: { version: 2 } },
  ]);
  assert.equal(refreshes, 2);
});

test("serves stale after failure and retries after a short backoff", async () => {
  let now = 0;
  let refreshes = 0;
  const cache = new InProcessSnapshotCache(300_000, 30_000, () => now);
  const original = { version: 1 };
  await cache.get(async () => original);

  now = 300_000;
  const failure = new Error("refresh failed");
  const stale = await cache.get(async () => {
    refreshes += 1;
    throw failure;
  });
  assert.deepEqual(stale, { status: "stale-if-error", value: original });

  now += 29_999;
  const throttled = await cache.get(async () => {
    refreshes += 1;
    return { version: 2 };
  });
  assert.deepEqual(throttled, { status: "stale-if-error", value: original });
  assert.equal(refreshes, 1);

  now += 1;
  const replacement = { version: 2 };
  const recovered = await cache.get(async () => {
    refreshes += 1;
    return replacement;
  });
  assert.deepEqual(recovered, { status: "refreshed", value: replacement });
  assert.equal(refreshes, 2);
});

test("propagates a cold-start refresh failure", async () => {
  const cache = new InProcessSnapshotCache<string>(300_000, 30_000);
  const failure = new Error("refresh failed");

  await assert.rejects(
    cache.get(async () => {
      throw failure;
    }),
    (error: unknown) => error === failure,
  );
});
