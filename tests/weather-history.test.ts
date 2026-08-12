import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateWeatherHistoryForChart,
  createWeatherHistoryCsv,
  findNearestWeatherPoint,
  validateWeatherHistoryRange,
} from "../lib/weather-history.ts";
import type { WeatherPoint } from "../lib/weather-types.ts";

function point(time: string, overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  return {
    time,
    kind: "observed",
    source: "environment_agency_current",
    temperatureC: 10,
    apparentTemperatureC: null,
    relativeHumidityPct: 80,
    cloudCoverPct: null,
    precipitationMm: null,
    pressureHpa: 1010,
    windSpeedMs: 2,
    windGustMs: 3,
    windDirectionDeg: 350,
    weatherCode: null,
    phenomenon: null,
    ...overrides,
  };
}

test("validates explicit, bounded past ranges", () => {
  const valid = validateWeatherHistoryRange("2026-06-01T00:00:00Z", "2026-08-01T00:00:00Z", {
    now: new Date("2026-08-12T00:00:00Z"),
  });
  assert.equal(valid.ok, true);
  assert.equal(validateWeatherHistoryRange(null, null).ok, false);
  assert.equal(validateWeatherHistoryRange("2026-06-01", "2026-07-01T00:00:00Z").ok, false);
  assert.equal(validateWeatherHistoryRange("2026-02-30T00:00:00Z", "2026-03-03T00:00:00Z").ok, false);
  assert.equal(validateWeatherHistoryRange("2026-02-01T24:01:00Z", "2026-03-03T00:00:00Z").ok, false);
  assert.equal(validateWeatherHistoryRange("2026-08-02T00:00:00Z", "2026-08-01T00:00:00Z").ok, false);
  assert.equal(validateWeatherHistoryRange("2026-01-01T00:00:00Z", "2026-08-01T00:00:00Z").ok, false);
  assert.equal(validateWeatherHistoryRange("2026-08-01T00:00:00Z", "2026-08-13T00:00:00Z", {
    now: new Date("2026-08-12T00:00:00Z"),
  }).ok, false);
  assert.equal(validateWeatherHistoryRange("0001-01-01T00:00:00Z", "0001-01-02T00:00:00Z", {
    now: new Date("2026-08-12T00:00:00Z"),
  }).ok, false);
  assert.equal(validateWeatherHistoryRange("2026-08-01T21:00:00Z", "2026-10-30T22:00:00Z", {
    now: new Date("2026-11-01T00:00:00Z"),
  }).ok, true);
});

test("keeps short history detailed and aggregates long history by kind and UTC hour", () => {
  const from = "2026-06-01T00:00:00.000Z";
  const to = "2026-07-01T00:00:00.000Z";
  const range = { from, to, fromMs: Date.parse(from), toMs: Date.parse(to), durationMs: Date.parse(to) - Date.parse(from) };
  const result = aggregateWeatherHistoryForChart([
    point("2026-06-01T00:10:00Z", { temperatureC: 10, precipitationMm: 0.2, windGustMs: 3 }),
    point("2026-06-01T00:40:00Z", { temperatureC: 14, precipitationMm: 0.3, windGustMs: 8 }),
    point("2026-06-01T00:40:00Z", { kind: "modeled", source: "open_meteo", temperatureC: 20 }),
  ], range);
  assert.deepEqual(result.resolution, { mode: "hourly", intervalMinutes: 60 });
  assert.equal(result.points.length, 2);
  assert.equal(result.points[0].temperatureC, 12);
  assert.equal(result.points[0].precipitationMm, 0.5);
  assert.equal(result.points[0].windGustMs, 8);
  assert.equal(result.points[1].kind, "modeled");
});

test("does not move the first aggregate point before the requested range", () => {
  const from = "2026-06-01T11:37:00.000Z";
  const to = "2026-07-01T11:37:00.000Z";
  const range = { from, to, fromMs: Date.parse(from), toMs: Date.parse(to), durationMs: Date.parse(to) - Date.parse(from) };
  const result = aggregateWeatherHistoryForChart([point("2026-06-01T11:40:00Z")], range);
  assert.equal(result.points[0].time, "2026-06-01T11:40:00.000Z");
});

test("treats the requested end timestamp as exclusive", () => {
  const from = "2026-06-01T00:00:00.000Z";
  const to = "2026-07-01T00:00:00.000Z";
  const range = { from, to, fromMs: Date.parse(from), toMs: Date.parse(to), durationMs: Date.parse(to) - Date.parse(from) };
  const result = aggregateWeatherHistoryForChart([
    point("2026-06-30T23:00:00Z"),
    point("2026-07-01T00:00:00Z"),
  ], range);
  assert.equal(result.points.length, 1);
  assert.equal(result.points[0].time, "2026-06-30T23:00:00.000Z");
});

test("nearest lookup honors its distance limit", () => {
  const points = [point("2026-08-01T10:00:00Z"), point("2026-08-01T11:00:00Z")];
  assert.equal(findNearestWeatherPoint(points, Date.parse("2026-08-01T10:40:00Z"))?.time, points[1].time);
  assert.equal(findNearestWeatherPoint(points, Date.parse("2026-08-01T14:00:00Z"), 30 * 60_000), null);
});

test("CSV is ordered, uses Tallinn time, leaves nulls blank, and neutralizes formulas", () => {
  const csv = createWeatherHistoryCsv([
    point("2026-01-01T10:00:00Z", { phenomenon: '=HYPERLINK("bad")', temperatureC: -4.5 }),
  ]);
  assert.ok(csv.startsWith("\uFEFFtime_utc"));
  assert.match(csv, /2026-01-01T12:00:00/);
  assert.match(csv, /,-4\.5,/);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
});
