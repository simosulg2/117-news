import assert from "node:assert/strict";
import test from "node:test";

import {
  storedWeatherRowToPoint,
  weatherObservationRowsForPersistence,
} from "../lib/weather-store.ts";
import type { WeatherPoint } from "../lib/weather-types.ts";

function observation(overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  return {
    time: "2026-08-12T10:20:34.000Z",
    kind: "observed",
    source: "environment_agency_current",
    temperatureC: 18.4,
    apparentTemperatureC: null,
    relativeHumidityPct: 72,
    cloudCoverPct: null,
    precipitationMm: 1.2,
    pressureHpa: 1014.7,
    windSpeedMs: 2.8,
    windGustMs: 5.1,
    windDirectionDeg: 225,
    weatherCode: null,
    phenomenon: "Variable clouds",
    ...overrides,
  };
}

test("maps PostgreSQL weather rows and drops rolling precipitation from non-hourly snapshots", () => {
  const point = storedWeatherRowToPoint({
    observed_at: "2026-08-12T10:20:00.000Z",
    temperature_c: "18.4",
    apparent_temperature_c: null,
    relative_humidity_pct: 72,
    cloud_cover_pct: "not-a-number",
    precipitation_mm: "0.2",
    pressure_hpa: 1014.7,
    wind_speed_ms: 2.8,
    wind_gust_ms: 5.1,
    wind_direction_deg: 225,
    weather_code: null,
    phenomenon: "  Variable clouds  ",
  });

  assert.deepEqual(point, {
    time: "2026-08-12T10:20:00.000Z",
    kind: "observed",
    source: "environment_agency_current",
    temperatureC: 18.4,
    apparentTemperatureC: null,
    relativeHumidityPct: 72,
    cloudCoverPct: null,
    precipitationMm: null,
    pressureHpa: 1014.7,
    windSpeedMs: 2.8,
    windGustMs: 5.1,
    windDirectionDeg: 225,
    weatherCode: null,
    phenomenon: "Variable clouds",
  });
});

test("retains additive precipitation on a canonical hourly interval-end row", () => {
  const point = storedWeatherRowToPoint({
    observed_at: "2026-08-12T10:00:00.000Z",
    temperature_c: null,
    apparent_temperature_c: null,
    relative_humidity_pct: null,
    cloud_cover_pct: null,
    precipitation_mm: "0.2",
    pressure_hpa: null,
    wind_speed_ms: null,
    wind_gust_ms: null,
    wind_direction_deg: null,
    weather_code: null,
    phenomenon: null,
  });

  assert.equal(point?.precipitationMm, 0.2);
});

test("rejects stored rows with invalid timestamps", () => {
  assert.equal(storedWeatherRowToPoint({
    observed_at: "invalid",
    temperature_c: null,
    apparent_temperature_c: null,
    relative_humidity_pct: null,
    cloud_cover_pct: null,
    precipitation_mm: null,
    pressure_hpa: null,
    wind_speed_ms: null,
    wind_gust_ms: null,
    wind_direction_deg: null,
    weather_code: null,
    phenomenon: null,
  }), null);
});

test("persists rolling XML precipitation once at its canonical hourly interval end", () => {
  const input = observation();
  const rows = weatherObservationRowsForPersistence(input);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { ...input, precipitationMm: null });
  assert.deepEqual(rows[1], {
    time: "2026-08-12T10:00:00.000Z",
    kind: "observed",
    source: "environment_agency_current",
    temperatureC: null,
    apparentTemperatureC: null,
    relativeHumidityPct: null,
    cloudCoverPct: null,
    precipitationMm: 1.2,
    pressureHpa: null,
    windSpeedMs: null,
    windGustMs: null,
    windDirectionDeg: null,
    weatherCode: null,
    phenomenon: null,
  });
  assert.equal(input.precipitationMm, 1.2);
});

test("maps repeated 10-minute precipitation readings to the same upsert key", () => {
  const first = weatherObservationRowsForPersistence(observation({
    time: "2026-08-12T10:20:00.000Z",
  }));
  const second = weatherObservationRowsForPersistence(observation({
    time: "2026-08-12T10:50:00.000Z",
  }));

  assert.equal(first[1].time, "2026-08-12T10:00:00.000Z");
  assert.equal(second[1].time, first[1].time);
  assert.equal(first[0].precipitationMm, null);
  assert.equal(second[0].precipitationMm, null);
});

test("uses the preceding interval before the hourly precipitation update", () => {
  const rows = weatherObservationRowsForPersistence(observation({
    time: "2026-08-12T10:05:00.000Z",
  }));

  assert.equal(rows[1].time, "2026-08-12T09:00:00.000Z");
});

test("defers precipitation persistence while the hourly XML value is updating", () => {
  const rows = weatherObservationRowsForPersistence(observation({
    time: "2026-08-12T10:12:00.000Z",
  }));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].precipitationMm, null);
});

test("does not create an hourly precipitation row when the XML value is absent", () => {
  const input = observation({ precipitationMm: null });
  assert.deepEqual(weatherObservationRowsForPersistence(input), [input]);
});

test("does not persist modeled or invalid-time points", () => {
  assert.deepEqual(weatherObservationRowsForPersistence(observation({ kind: "modeled" })), []);
  assert.deepEqual(weatherObservationRowsForPersistence(observation({ time: "invalid" })), []);
});
