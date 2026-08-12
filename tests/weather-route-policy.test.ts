import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateWeatherCollector,
  publicWeatherStatus,
  runWeatherCollection,
  weatherCollectorPublicResult,
} from "../lib/weather-route-policy.ts";

const TOKEN = "a".repeat(64);

test("authenticates only the exact configured Bearer token", () => {
  assert.equal(authenticateWeatherCollector(`Bearer ${TOKEN}`, TOKEN), "authorized");
  assert.equal(authenticateWeatherCollector(`bearer ${TOKEN}`, TOKEN), "authorized");
  assert.equal(authenticateWeatherCollector(`Bearer ${"A".repeat(64)}`, TOKEN), "unauthorized");
  assert.equal(authenticateWeatherCollector(`Bearer ${"b".repeat(32)}`, TOKEN), "unauthorized");
  assert.equal(authenticateWeatherCollector(null, TOKEN), "unauthorized");
  assert.equal(authenticateWeatherCollector(`Basic ${TOKEN}`, TOKEN), "unauthorized");
  assert.equal(authenticateWeatherCollector(`Bearer ${TOKEN} extra`, TOKEN), "unauthorized");
});

test("rejects unsafe collector token configuration", () => {
  assert.equal(authenticateWeatherCollector(`Bearer ${TOKEN}`, undefined), "unconfigured");
  assert.equal(authenticateWeatherCollector(`Bearer ${TOKEN}`, ""), "unconfigured");
  assert.equal(authenticateWeatherCollector(`Bearer ${TOKEN}`, "too-short"), "unconfigured");
  assert.equal(authenticateWeatherCollector(`Bearer ${TOKEN}`, `${"a".repeat(32)} token`), "unconfigured");
  assert.equal(authenticateWeatherCollector(`Bearer ${TOKEN}`, "a".repeat(513)), "unconfigured");
  assert.equal(authenticateWeatherCollector(`Bearer ${"a".repeat(513)}`, TOKEN), "unauthorized");
});

test("collector does no work when the weather store is not configured", async () => {
  let loaded = false;
  let saved = false;
  const result = await runWeatherCollection({
    storeConfigured: false,
    loadCurrent: async () => {
      loaded = true;
      return { time: "unused" };
    },
    save: async () => {
      saved = true;
      return true;
    },
  });

  assert.deepEqual(result, { outcome: "weather_store_not_configured" });
  assert.equal(loaded, false);
  assert.equal(saved, false);
});

test("collector distinguishes observation and persistence failures", async () => {
  const sourceFailure = new Error("upstream detail must stay internal");
  const unavailable = await runWeatherCollection({
    storeConfigured: true,
    loadCurrent: async () => { throw sourceFailure; },
    save: async () => true,
  });
  assert.equal(unavailable.outcome, "current_observation_unavailable");
  assert.equal(unavailable.outcome === "current_observation_unavailable" && unavailable.cause, sourceFailure);

  const skipped = await runWeatherCollection({
    storeConfigured: true,
    loadCurrent: async () => ({ time: "2026-08-12T00:00:00.000Z" }),
    save: async () => false,
  });
  assert.deepEqual(skipped, { outcome: "weather_store_unavailable" });

  const databaseFailure = Object.assign(new Error("postgresql://secret@db/private"), { code: "57014" });
  const failed = await runWeatherCollection({
    storeConfigured: true,
    loadCurrent: async () => ({ time: "2026-08-12T00:00:00.000Z" }),
    save: async () => { throw databaseFailure; },
  });
  assert.equal(failed.outcome, "weather_store_unavailable");
  assert.equal(failed.outcome === "weather_store_unavailable" && failed.cause, databaseFailure);
});

test("collector reports success only after the write resolves", async () => {
  let releaseWrite: ((saved: boolean) => void) | undefined;
  const write = new Promise<boolean>((resolve) => { releaseWrite = resolve; });
  let settled = false;
  const collection = runWeatherCollection({
    storeConfigured: true,
    loadCurrent: async () => ({ time: "2026-08-12T00:00:00.000Z" }),
    save: async () => write,
  }).then((result) => {
    settled = true;
    return result;
  });

  await Promise.resolve();
  assert.equal(settled, false);
  releaseWrite?.(true);
  assert.deepEqual(await collection, {
    outcome: "saved",
    value: { time: "2026-08-12T00:00:00.000Z" },
  });
});

test("collector public results expose only fixed safe fields", () => {
  assert.deepEqual(weatherCollectorPublicResult("unauthorized"), {
    status: 401,
    body: { ok: false, code: "unauthorized" },
  });
  assert.deepEqual(weatherCollectorPublicResult("current_observation_unavailable"), {
    status: 502,
    body: { ok: false, code: "current_observation_unavailable" },
  });
  assert.deepEqual(weatherCollectorPublicResult("weather_store_unavailable"), {
    status: 503,
    body: { ok: false, code: "weather_store_unavailable" },
  });
  assert.deepEqual(weatherCollectorPublicResult("saved", "2026-08-12T00:00:00.000Z"), {
    status: 200,
    body: { ok: true, observedAt: "2026-08-12T00:00:00.000Z" },
  });
  assert.doesNotMatch(
    JSON.stringify(weatherCollectorPublicResult("weather_store_unavailable")),
    /secret|postgres|password/i,
  );
});

test("stored history keeps a fully degraded public weather response usable", () => {
  assert.equal(publicWeatherStatus(true, 1), 200);
  assert.equal(publicWeatherStatus(true, 0), 502);
  assert.equal(publicWeatherStatus(false, 0), 200);
});
