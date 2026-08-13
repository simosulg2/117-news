import assert from "node:assert/strict";
import test from "node:test";

import {
  DAY_MS,
  deduplicatePoints,
  pointsForField,
  rangeWindow,
  summarizePeriodPoints,
} from "../features/weather/model/weather-client-model.ts";
import type { WeatherPoint } from "../lib/weather-types.ts";

function point(
  time: string,
  kind: WeatherPoint["kind"],
  source: WeatherPoint["source"],
  values: Partial<WeatherPoint> = {},
): WeatherPoint {
  return {
    time,
    kind,
    source,
    temperatureC: null,
    apparentTemperatureC: null,
    relativeHumidityPct: null,
    cloudCoverPct: null,
    precipitationMm: null,
    pressureHpa: null,
    windSpeedMs: null,
    windGustMs: null,
    windDirectionDeg: null,
    weatherCode: null,
    phenomenon: null,
    ...values,
  };
}

test("range windows preserve history, current, and forecast semantics", () => {
  const now = Date.parse("2026-08-13T12:00:00Z");
  assert.deepEqual(rangeWindow("history", "3d", "", "", now), {
    start: now - 3 * DAY_MS,
    end: now,
  });
  assert.deepEqual(rangeWindow("forecast", "24h", "", "", now), {
    start: now,
    end: now + DAY_MS,
  });
  assert.deepEqual(rangeWindow("now", "24h", "", "", now), {
    start: now - DAY_MS / 2,
    end: now + DAY_MS / 2,
  });
});

test("custom history windows use Tallinn dates, cap at 90 days, and never end in the future", () => {
  const now = Date.parse("2026-08-13T12:00:00Z");
  const result = rangeWindow("history", "date", "2026-05-01", "2026-12-31", now);
  assert.equal(new Date(result.start).toISOString(), "2026-04-30T21:00:00.000Z");
  assert.equal(new Date(result.end).toISOString(), "2026-07-29T21:00:00.000Z");
  assert.ok(result.end <= now);
});

test("deduplication keeps the final identical point while retaining source and kind variants", () => {
  const older = point("2026-08-13T09:00:00Z", "observed", "environment_agency_history", { temperatureC: 10 });
  const replacement = { ...older, temperatureC: 11 };
  const current = point("2026-08-13T10:00:00Z", "observed", "environment_agency_current", { temperatureC: 12 });
  const modeled = point("2026-08-13T09:00:00Z", "modeled", "open_meteo", { temperatureC: 9 });

  assert.deepEqual(deduplicatePoints([current, older, modeled, replacement]), [replacement, modeled, current]);
});

test("metric samples prefer observations without hiding modeled coverage", () => {
  const points = [
    point("2026-08-13T09:00:00Z", "modeled", "open_meteo", { temperatureC: 8 }),
    point("2026-08-13T09:00:00Z", "observed", "environment_agency_history", { temperatureC: 10 }),
    point("2026-08-13T10:00:00Z", "observed", "environment_agency_current", { temperatureC: 12 }),
  ];

  assert.deepEqual(pointsForField(points, "temperatureC"), {
    values: [10, 12],
    kind: "observed",
    observedCount: 2,
    modeledCount: 1,
  });
});

test("period summaries are inclusive, prefer measured values, and count distinct timestamps", () => {
  const points = [
    point("2026-08-13T09:00:00Z", "observed", "environment_agency_history", { temperatureC: 10, phenomenon: "Clear" }),
    point("2026-08-13T09:00:00Z", "modeled", "open_meteo", { temperatureC: 7, relativeHumidityPct: 80 }),
    point("2026-08-13T10:00:00Z", "observed", "environment_agency_current", { temperatureC: 12, phenomenon: "Clear" }),
    point("2026-08-13T11:00:00Z", "observed", "environment_agency_current", { temperatureC: 99, phenomenon: "Fog" }),
  ];
  const summary = summarizePeriodPoints(
    points,
    Date.parse("2026-08-13T09:00:00Z"),
    Date.parse("2026-08-13T10:00:00Z"),
  );

  assert.equal(summary.selectedPoints.length, 3);
  assert.deepEqual(summary.samples.temperatureC.values, [10, 12]);
  assert.deepEqual(summary.samples.relativeHumidityPct.values, [80]);
  assert.equal(summary.samples.relativeHumidityPct.kind, "modeled");
  assert.equal(summary.phenomenon, "Clear");
  assert.equal(summary.observedCount, 2);
  assert.equal(summary.modeledCount, 1);
});
