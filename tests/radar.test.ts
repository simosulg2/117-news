import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRadarTimeline,
  isRadarStale,
  parseOfficialRadarNotices,
  parseOfficialRadarPage,
  parseWmsLayerTimes,
} from "../lib/radar.ts";

test("parses and safely caps the official radar page configuration", () => {
  const page = `
    <script>
      _var["ExistsTimes"] = [
        "2026-08-11T20:50:00.000Z",
        "not-a-time",
        "2026-08-11T20:55:00.000Z",
        "2026-08-11T20:55:00.000Z"
      ];
      _var["sliderConf"] = {"radarImagesCount":999,"nowcastImagesCount":999};
    </script>
  `;

  assert.deepEqual(parseOfficialRadarPage(page), {
    observedTimes: ["2026-08-11T20:50:00.000Z", "2026-08-11T20:55:00.000Z"],
    observedCount: 36,
    forecastCount: 18,
    intervalMinutes: 5,
  });
});

test("supports the official page's older pipe-separated timeline", () => {
  const page = `<script>var ExistsTimes = "2026-08-11T20:50:00.000Z|2026-08-11T20:55:00.000Z";</script>`;
  const parsed = parseOfficialRadarPage(page);

  assert.equal(parsed.observedTimes.length, 2);
  assert.equal(parsed.observedCount, 36);
  assert.equal(parsed.forecastCount, 18);
});

test("builds a bounded observed and forecast timeline with no overlap", () => {
  const observedTimes = Array.from({ length: 50 }, (_, index) =>
    new Date(Date.UTC(2026, 7, 11, 18, index * 5)).toISOString(),
  );
  const latestObservation = Date.parse(observedTimes.at(-1) as string);
  const forecastTimes = Array.from({ length: 18 }, (_, index) =>
    new Date(latestObservation + (index + 1) * 5 * 60_000).toISOString(),
  );
  const timeline = buildRadarTimeline({
    observedTimes,
    observedCount: 36,
    forecastCount: 18,
    forecastTimes,
    intervalMinutes: 5,
  });

  assert.equal(timeline.frames.length, 54);
  assert.equal(timeline.frames.filter((frame) => frame.kind === "observed").length, 36);
  assert.equal(timeline.frames.filter((frame) => frame.kind === "forecast").length, 18);
  assert.equal(Date.parse(timeline.forecastStartsAt as string) - Date.parse(timeline.latestObservation), 5 * 60_000);
  assert.ok(timeline.frames.every((frame, index) => index === 0 || frame.time > timeline.frames[index - 1].time));
});

test("includes only exact forecast times advertised by the WMS", () => {
  const latestObservation = "2026-08-11T21:00:00.000Z";
  const timeline = buildRadarTimeline({
    observedTimes: [latestObservation],
    observedCount: 36,
    forecastCount: 18,
    forecastTimes: [
      "2026-08-11T21:05:00.000Z",
      "2026-08-11T21:15:00.000Z",
      "2026-08-11T22:35:00.000Z",
      "not-a-time",
    ],
    intervalMinutes: 5,
  });

  assert.deepEqual(
    timeline.frames.filter((frame) => frame.kind === "forecast").map((frame) => frame.time),
    ["2026-08-11T21:05:00.000Z", "2026-08-11T21:15:00.000Z"],
  );
});

test("extracts visible named-radar outage notices and ignores script text", () => {
  const page = `
    <script>const fake = "Harku radar ei tööta.";</script>
    <p>S&uuml;rgavere radar hetkel tehniliste probleemide tõttu ei tööta, tegeleme probleemi lahendamisega.</p>
    <p>Suure koormuse korral võib radarivaates esineda häireid.</p>
  `;

  assert.deepEqual(parseOfficialRadarNotices(page), [
    "Sürgavere radar hetkel tehniliste probleemide tõttu ei tööta, tegeleme probleemi lahendamisega.",
  ]);
});

test("extracts and normalizes a WMS layer time extent", () => {
  const capabilities = `
    <Layer>
      <Name>cmp_cap</Name>
      <Dimension name="time" units="ISO8601" />
      <Extent name="time">2026-08-11T20:55:00Z, 2026-08-11T21:00:00.000Z</Extent>
    </Layer>
  `;

  assert.deepEqual(parseWmsLayerTimes(capabilities, "cmp_cap"), [
    "2026-08-11T20:55:00.000Z",
    "2026-08-11T21:00:00.000Z",
  ]);
  assert.deepEqual(parseWmsLayerTimes(capabilities, "nowcasting"), []);
});

test("marks radar stale only after the freshness window", () => {
  const observation = "2026-08-11T21:00:00.000Z";
  assert.equal(isRadarStale(observation, Date.parse("2026-08-11T21:29:59.000Z")), false);
  assert.equal(isRadarStale(observation, Date.parse("2026-08-11T21:30:01.000Z")), true);
  assert.equal(isRadarStale("bad value", Date.now()), true);
});
