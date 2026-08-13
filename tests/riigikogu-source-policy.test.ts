import assert from "node:assert/strict";
import test from "node:test";
import { RiigikoguRequestScheduler } from "../features/riigikogu/server/riigikogu-source.server.ts";

test("serializes upstream work and leaves at least one second between starts", async () => {
  let now = 0;
  const starts: number[] = [];
  const scheduler = new RiigikoguRequestScheduler(() => now, async (milliseconds) => { now += milliseconds; });
  await Promise.all([1, 2, 3].map((value) => scheduler.schedule("/api/votings", async () => {
    starts.push(now); return value;
  })));
  assert.deepEqual(starts, [0, 1050, 2100]);
});

test("a failed operation does not poison the serialized request queue", async () => {
  let now = 0;
  const scheduler = new RiigikoguRequestScheduler(() => now, async (milliseconds) => { now += milliseconds; });
  await assert.rejects(scheduler.schedule("/api/agenda/plenary", async () => { throw new Error("upstream"); }));
  const result = await scheduler.schedule("/api/votings", async () => "ok");
  assert.equal(result, "ok");
  assert.equal(now, 1050);
});

test("thirteenth request to one path waits for its minute window", async () => {
  let now = 0;
  const starts: number[] = [];
  const scheduler = new RiigikoguRequestScheduler(() => now, async (milliseconds) => { now += milliseconds; });
  for (let request = 0; request < 13; request += 1) {
    await scheduler.schedule("/api/votings", async () => { starts.push(now); });
  }
  assert.equal(starts[11], 11_550);
  assert.equal(starts[12], 60_000);
});
