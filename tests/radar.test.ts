import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRadarTimeline,
  isRadarStale,
  parseOfficialRadarNotices,
  parseOfficialRadarPage,
  parseWmsLayerTimes,
} from "../lib/radar.ts";
import {
  baseMapTiles,
  clampMapCenter,
  initialRadarZoom,
  labelMapTiles,
  minimumRadarZoom,
  pointInViewport,
  project,
  radarFrameTiles,
  radarTilePlan,
  RADAR_EXTENT,
  RADAR_RESOLUTIONS,
  unproject,
  visibleTileSlots,
  VORU_COORDINATES,
} from "../features/weather/radar/model/radar-map-model.ts";
import {
  projectToLest,
  unprojectFromLest,
} from "../features/weather/radar/model/radar-projection.ts";
import {
  isRadarManifest,
  preferredFrameIndex,
  radarPrefetchFrameIndices,
} from "../features/weather/radar/model/radar-manifest-model.ts";
import type { RadarManifest } from "../features/weather/radar/model/radar-types.ts";

function radarManifest(): RadarManifest {
  return {
    generatedAt: "2026-08-11T21:00:00.000Z",
    stale: false,
    degraded: false,
    notices: [],
    frames: [],
    latestObservation: "2026-08-11T21:00:00.000Z",
    forecastStartsAt: null,
    intervalMinutes: 5,
    map: {
      center: VORU_COORDINATES,
      initialZoom: 2,
      projection: "EPSG:3301",
      baseTileUrlTemplate: "https://tiles.envir.ee/tm/tms/1.0.0/ilmateenistus-radar@LEST/{z}/{x}/{-y}.png",
      labelTileUrlTemplate: "https://tiles.envir.ee/tm/tms/1.0.0/ilmateenistus-kohanimed@LEST/{z}/{x}/{-y}.png",
      observedTileUrlTemplate: "https://ilmtiles.envir.ee/tiles/ilm/cmp_cap/{TIME}/{z}/{x}/{-y}.png",
      wmsUrl: "https://ilmgs.envir.ee/geoserver/ilm/wms",
      observed: { layer: "ilm:cmp_cap", style: "ilm:opera_radar_talv" },
      forecast: { layer: "ilm:nowcasting", style: "ilm:opera_radar" },
    },
    source: {
      name: "Keskkonnaagentuur",
      pageUrl: "https://www.ilmateenistus.ee/ilm/ilmavaatlused/radar/",
      dataUrl: "https://ilmgs.envir.ee/geoserver/ilm/wms",
      attribution: "Radariandmed: Keskkonnaagentuur",
      license: "CC BY 4.0",
    },
  };
}

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

test("follows a refreshed live frame while preserving an intentional historical selection", () => {
  const previous = {
    latestObservation: "2026-08-11T21:00:00.000Z",
    frames: [
      { time: "2026-08-11T20:55:00.000Z", kind: "observed" },
      { time: "2026-08-11T21:00:00.000Z", kind: "observed" },
    ],
  } as RadarManifest;
  const refreshed = {
    latestObservation: "2026-08-11T21:05:00.000Z",
    frames: [
      ...previous.frames,
      { time: "2026-08-11T21:05:00.000Z", kind: "observed" },
      { time: "2026-08-11T21:10:00.000Z", kind: "forecast" },
    ],
  } as RadarManifest;

  assert.equal(preferredFrameIndex(refreshed), 2);
  assert.equal(preferredFrameIndex(refreshed, previous, 1), 2);
  assert.equal(preferredFrameIndex(refreshed, previous, 0), 0);
});

test("bounds radar image warming and prioritizes the next animation frames", () => {
  assert.deepEqual(radarPrefetchFrameIndices(54, 0), [1, 53]);
  assert.deepEqual(radarPrefetchFrameIndices(54, 20), [21, 19]);
  assert.deepEqual(radarPrefetchFrameIndices(54, 53), [0, 52]);
  assert.deepEqual(radarPrefetchFrameIndices(54, 20, true), [21, 22]);
  assert.deepEqual(radarPrefetchFrameIndices(2, 0), [1]);
  assert.deepEqual(radarPrefetchFrameIndices(0, 0), []);
});

test("projects Võru onto the official L-EST97 grid and reverses it", () => {
  const projectedLest = projectToLest(VORU_COORDINATES);
  assert.ok(Math.abs(projectedLest.x - 679_261.7288) < 0.001);
  assert.ok(Math.abs(projectedLest.y - 6_415_651.4989) < 0.001);
  const restoredLest = unprojectFromLest(projectedLest);
  assert.ok(Math.abs(restoredLest.latitude - VORU_COORDINATES.latitude) < 1e-9);
  assert.ok(Math.abs(restoredLest.longitude - VORU_COORDINATES.longitude) < 1e-9);
});

test("keeps the official tile grid, viewport marker, and TMS orientation stable", () => {
  const zoom = 2;
  const size = { width: 800, height: 400 };
  const projected = project(VORU_COORDINATES, zoom);
  const restored = unproject(projected, zoom);

  assert.ok(Math.abs(restored.latitude - VORU_COORDINATES.latitude) < 1e-9);
  assert.ok(Math.abs(restored.longitude - VORU_COORDINATES.longitude) < 1e-9);
  assert.deepEqual(pointInViewport(VORU_COORDINATES, VORU_COORDINATES, zoom, size), {
    x: 400,
    y: 200,
  });

  assert.deepEqual(RADAR_EXTENT, [40_500, 5_993_000, 1_064_500, 7_017_000]);
  assert.equal(RADAR_RESOLUTIONS[zoom], 1_000);
  const slots = visibleTileSlots(VORU_COORDINATES, zoom, size);
  assert.ok(slots.length > 0 && slots.length <= 12);
  assert.equal(new Set(slots.map((tile) => tile.key)).size, slots.length);
  assert.ok(slots.every((tile) => tile.tmsY === 2 ** zoom - 1 - tile.y));
  assert.deepEqual(visibleTileSlots(VORU_COORDINATES, zoom, { width: 0, height: 400 }), []);
});

test("uses a closer official-grid zoom only for wide radar panels", () => {
  assert.equal(initialRadarZoom(360, 2), 2);
  assert.equal(initialRadarZoom(800, 2), 2);
  assert.equal(initialRadarZoom(900, 2), 2);
  assert.equal(initialRadarZoom(1_200, 2), 3);
  assert.equal(minimumRadarZoom({ width: 900, height: 416 }), 2);
  assert.equal(minimumRadarZoom({ width: 1_200, height: 416 }), 3);
});

test("keeps panning inside the finite official radar grid", () => {
  const size = { width: 360, height: 320 };
  const clamped = clampMapCenter({ latitude: 65, longitude: 35 }, 2, size);
  const point = project(clamped, 2);
  assert.ok(point.x <= 1_024 - size.width / 2);
  assert.ok(point.y >= size.height / 2);

  const wideSize = { width: 900, height: 416 };
  const wideCenter = clampMapCenter(VORU_COORDINATES, 2, wideSize);
  const widePoint = project(wideCenter, 2);
  assert.ok(widePoint.x <= 1_024 - wideSize.width / 2);

  const safeZoom = minimumRadarZoom(wideSize);
  const zoomedOut = clampMapCenter(clamped, safeZoom, wideSize);
  const zoomedOutPoint = project(zoomedOut, safeZoom);
  const worldPixels = 256 * 2 ** safeZoom;
  assert.ok(zoomedOutPoint.x <= worldPixels - wideSize.width / 2 + 1e-6);
});

test("keeps frame request identity stable while panning within one tile set", () => {
  const manifest = radarManifest();
  const frame = { time: "2026-08-11T21:00:00.000Z", kind: "observed" } as const;
  const size = { width: 360, height: 320 };
  const firstSlots = visibleTileSlots(VORU_COORDINATES, 4, size);
  const shiftedSlots = visibleTileSlots(
    { ...VORU_COORDINATES, longitude: VORU_COORDINATES.longitude + 0.005 },
    4,
    size,
  );
  const first = radarTilePlan(manifest, frame, firstSlots);
  const shifted = radarTilePlan(manifest, frame, shiftedSlots);

  assert.deepEqual(firstSlots.map((slot) => slot.key), shiftedSlots.map((slot) => slot.key));
  assert.equal(first.id, shifted.id);
  assert.notEqual(first.tiles[0].left, shifted.tiles[0].left);
});

test("builds cache-stable official base, label, and observed tile URLs", () => {
  const manifest = radarManifest();
  const slot = visibleTileSlots(VORU_COORDINATES, 2, { width: 1, height: 1 })[0];
  assert.deepEqual({ x: slot.x, y: slot.y, tmsY: slot.tmsY }, { x: 2, y: 2, tmsY: 1 });
  assert.equal(
    baseMapTiles(manifest, [slot])[0].url,
    "https://tiles.envir.ee/tm/tms/1.0.0/ilmateenistus-radar@LEST/2/2/1.png",
  );
  assert.equal(
    labelMapTiles(manifest, [slot])[0].url,
    "https://tiles.envir.ee/tm/tms/1.0.0/ilmateenistus-kohanimed@LEST/2/2/1.png",
  );
  const observed = radarFrameTiles(
    manifest,
    { time: "2026-08-11T21:00:00.000Z", kind: "observed" },
    [slot],
  )[0];
  assert.equal(
    observed.url,
    "https://ilmtiles.envir.ee/tiles/ilm/cmp_cap/2026-08-11T21%3A00%3A00.000Z/2/2/1.png",
  );
  assert.ok(observed.fallbackUrl?.includes("LAYERS=ilm%3Acmp_cap"));
});

test("uses aligned 256px EPSG:3301 WMS tiles only for forecast frames", () => {
  const manifest = radarManifest();
  const slot = visibleTileSlots(VORU_COORDINATES, 2, { width: 1, height: 1 })[0];
  const forecast = radarFrameTiles(
    manifest,
    { time: "2026-08-11T21:05:00.000Z", kind: "forecast" },
    [slot],
  )[0];
  const url = new URL(forecast.url);
  assert.equal(url.origin, "https://ilmgs.envir.ee");
  assert.equal(url.searchParams.get("LAYERS"), "ilm:nowcasting");
  assert.equal(url.searchParams.get("STYLES"), "ilm:opera_radar");
  assert.equal(url.searchParams.get("SRS"), "EPSG:3301");
  assert.equal(url.searchParams.get("WIDTH"), "256");
  assert.equal(url.searchParams.get("FORMAT"), "image/png8");
  assert.equal(url.searchParams.get("HEIGHT"), "256");
  assert.equal(url.searchParams.get("TILED"), "true");
  assert.equal(url.searchParams.get("TIME"), "2026-08-11T21:05:00.000Z");
  assert.equal(url.searchParams.get("BBOX"), slot.bbox.join(","));
  assert.equal(forecast.fallbackUrl, null);
});

test("accepts only the trusted official native-grid manifest contract", () => {
  const valid = {
    ...radarManifest(),
    frames: [{ time: "2026-08-11T21:00:00.000Z", kind: "observed" }],
  } as RadarManifest;
  assert.equal(isRadarManifest(valid), true);
  assert.equal(isRadarManifest({
    ...valid,
    map: { ...valid.map, observedTileUrlTemplate: "https://example.test/{z}/{x}/{-y}.png" },
  }), false);
  assert.equal(isRadarManifest({
    ...valid,
    map: { ...valid.map, projection: "EPSG:3857" },
  }), false);
});
