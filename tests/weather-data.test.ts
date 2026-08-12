import assert from "node:assert/strict";
import test from "node:test";

import {
  WeatherParseError,
  aggregateDailyWeather,
  mergeWeatherPoints,
  parseCurrentObservationXml,
  parseOfficialHistoryRows,
  parseOpenMeteoResponse,
  utcMonthRanges,
} from "../lib/weather-data.ts";
import type { WeatherPoint } from "../lib/weather-types.ts";

function point(overrides: Partial<WeatherPoint> = {}): WeatherPoint {
  return {
    time: "2026-08-10T12:00:00.000Z",
    kind: "observed",
    source: "environment_agency_history",
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
    ...overrides,
  };
}

test("parses the official Võru current observation by WMO code", () => {
  const xml = `<?xml version="1.0"?>
    <observations timestamp="1786492763">
      <station><name>Not Võru</name><wmocode>11111</wmocode><airtemperature>99</airtemperature></station>
      <station>
        <name>Võru</name><wmocode>26249</wmocode>
        <phenomenon>Few clouds &amp; dry</phenomenon>
        <precipitations>0.2</precipitations><airpressure>1016.3</airpressure>
        <relativehumidity>91.9</relativehumidity><airtemperature>11</airtemperature>
        <winddirection>244</winddirection><windspeed>3.2</windspeed><windspeedmax>5.6</windspeedmax>
      </station>
    </observations>`;

  const parsed = parseCurrentObservationXml(xml);
  assert.equal(parsed.updatedAt, "2026-08-11T23:59:23.000Z");
  assert.deepEqual(parsed.point, point({
    time: "2026-08-11T23:59:23.000Z",
    source: "environment_agency_current",
    temperatureC: 11,
    relativeHumidityPct: 91.9,
    precipitationMm: 0.2,
    pressureHpa: 1016.3,
    windSpeedMs: 3.2,
    windGustMs: 5.6,
    windDirectionDeg: 244,
    phenomenon: "Few clouds & dry",
  }));
});

test("rejects current XML that has no Võru station", () => {
  assert.throws(
    () => parseCurrentObservationXml(
      '<observations timestamp="1786492763"><station><wmocode>26038</wmocode></station></observations>',
    ),
    WeatherParseError,
  );
});

test("pivots official climate rows into UTC hourly observations", () => {
  const rows = [
    { aasta: 2026, kuu: 8, paev: 10, tund: 21, vaartus: 16.6, element_kood: "TA", avaandmed_ts: "2026-08-11T05:02:02+03:00" },
    { aasta: 2026, kuu: 8, paev: 10, tund: 21, vaartus: 95, element_kood: "RH", avaandmed_ts: "2026-08-11T05:02:02+03:00" },
    { aasta: 2026, kuu: 8, paev: 10, tund: 21, vaartus: 2, element_kood: "PR1H", avaandmed_ts: "2026-08-11T05:02:02+03:00" },
    { aasta: 2026, kuu: 8, paev: 10, tund: 21, vaartus: 8.2, element_kood: "WSX1H", avaandmed_ts: "2026-08-11T05:02:02+03:00" },
  ];

  const parsed = parseOfficialHistoryRows(rows);
  assert.equal(parsed.updatedAt, "2026-08-11T02:02:02.000Z");
  assert.equal(parsed.points.length, 1);
  assert.deepEqual(parsed.points[0], point({
    time: "2026-08-10T21:00:00.000Z",
    temperatureC: 16.6,
    relativeHumidityPct: 95,
    precipitationMm: 2,
    windGustMs: 8.2,
  }));
});

test("parses Open-Meteo hourly fields and splits at the current UTC hour", () => {
  const input = {
    utc_offset_seconds: 0,
    hourly: {
      time: ["2026-08-11T22:00", "2026-08-11T23:00", "2026-08-12T00:00"],
      temperature_2m: [10, 11, 12],
      apparent_temperature: [9, 10, 11],
      relative_humidity_2m: [90, 85, 80],
      cloud_cover: [100, 50, 0],
      precipitation: [0.1, 0, 0],
      pressure_msl: [1010, 1011, 1012],
      wind_speed_10m: [2, 3, 4],
      wind_gusts_10m: [4, 5, 6],
      wind_direction_10m: [200, 210, 220],
      weather_code: [61, 2, 0],
    },
  };

  const parsed = parseOpenMeteoResponse(input, new Date("2026-08-11T23:59:35Z"));
  assert.equal(parsed.modeledHistory.length, 1);
  assert.equal(parsed.forecast.length, 2);
  assert.equal(parsed.forecast[0].time, "2026-08-11T23:00:00.000Z");
  assert.equal(parsed.forecast[0].temperatureC, 11);
  assert.equal(parsed.forecast[0].cloudCoverPct, 50);
  assert.equal(parsed.forecast[0].kind, "modeled");
  assert.equal(parsed.forecast[0].source, "open_meteo");
});

test("rejects mismatched Open-Meteo series lengths", () => {
  const input = {
    utc_offset_seconds: 0,
    hourly: {
      time: ["2026-08-11T22:00"],
      temperature_2m: [],
      apparent_temperature: [9],
      relative_humidity_2m: [90],
      cloud_cover: [100],
      precipitation: [0],
      pressure_msl: [1010],
      wind_speed_10m: [2],
      wind_gusts_10m: [4],
      wind_direction_10m: [200],
      weather_code: [3],
    },
  };
  assert.throws(() => parseOpenMeteoResponse(input), WeatherParseError);
});

test("merges later observation fields without mutating either input", () => {
  const archive = point({ temperatureC: 10, relativeHumidityPct: 80 });
  const stored = point({
    source: "environment_agency_current",
    temperatureC: 11,
    windSpeedMs: 3,
  });
  const merged = mergeWeatherPoints([archive], [stored]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].temperatureC, 11);
  assert.equal(merged[0].relativeHumidityPct, 80);
  assert.equal(merged[0].windSpeedMs, 3);
  assert.equal(merged[0].source, "environment_agency_current");
  assert.equal(archive.temperatureC, 10);
});

test("aggregates Tallinn-local days and keeps observed and modeled summaries separate", () => {
  const summaries = aggregateDailyWeather([
    point({
      time: "2026-01-01T22:30:00.000Z",
      temperatureC: -5,
      relativeHumidityPct: 90,
      precipitationMm: 0.2,
      windGustMs: 5,
    }),
    point({
      time: "2026-01-02T10:00:00.000Z",
      temperatureC: 1,
      relativeHumidityPct: 70,
      precipitationMm: 0.3,
      windSpeedMs: 3,
    }),
    point({
      time: "2026-01-02T10:00:00.000Z",
      kind: "modeled",
      source: "open_meteo",
      temperatureC: 2,
    }),
  ]);

  assert.deepEqual(summaries, [
    {
      date: "2026-01-02",
      kind: "modeled",
      tempMinC: 2,
      tempMaxC: 2,
      precipitationMm: null,
      humidityAvgPct: null,
      windMaxMs: null,
    },
    {
      date: "2026-01-02",
      kind: "observed",
      tempMinC: -5,
      tempMaxC: 1,
      precipitationMm: 0.5,
      humidityAvgPct: 80,
      windMaxMs: 5,
    },
  ]);
});

test("builds bounded UTC month ranges across New Year", () => {
  assert.deepEqual(
    utcMonthRanges(new Date("2025-12-29T00:00:00Z"), new Date("2026-01-04T23:59:00Z")),
    [
      { year: 2025, month: 12, firstDay: 29, lastDay: 31 },
      { year: 2026, month: 1, firstDay: 1, lastDay: 4 },
    ],
  );
});
