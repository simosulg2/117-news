import type { RadarFrame } from "../../../../lib/radar.ts";
import { projectToLest, unprojectFromLest } from "./radar-projection.ts";
import type {
  Coordinates,
  MapSize,
  MapTile,
  Point,
  RadarFrameTile,
  RadarManifest,
  RadarTilePlan,
  RadarTileSlot,
} from "./radar-types.ts";

export const TILE_SIZE = 256;
export const RADAR_EXTENT = [40_500, 5_993_000, 1_064_500, 7_017_000] as const;
export const RADAR_RESOLUTIONS = [
  4_000, 2_000, 1_000, 500, 250, 125, 62.5, 31.25, 15.625,
  7.8125, 3.90625, 1.953125, 0.9765625, 0.48828125,
] as const;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;
export const ZERO_POINT: Point = { x: 0, y: 0 };
export const VORU_COORDINATES: Coordinates = { latitude: 57.8463, longitude: 27.0195 };

export function initialRadarZoom(mapWidth: number, fallback = 2): number {
  return mapWidth >= 960 ? Math.max(3, fallback) : clamp(fallback, MIN_ZOOM, MAX_ZOOM);
}

export function minimumRadarZoom(size: MapSize): number {
  return clamp(
    Math.ceil(Math.log2(Math.max(size.width, size.height, TILE_SIZE) / TILE_SIZE)),
    MIN_ZOOM,
    MAX_ZOOM,
  );
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function resolution(zoom: number): number {
  return RADAR_RESOLUTIONS[clamp(Math.round(zoom), 0, RADAR_RESOLUTIONS.length - 1)];
}

export function project(coordinates: Coordinates, zoom: number): Point {
  const lest = projectToLest(coordinates);
  const unitsPerPixel = resolution(zoom);
  return {
    x: (lest.x - RADAR_EXTENT[0]) / unitsPerPixel,
    y: (RADAR_EXTENT[3] - lest.y) / unitsPerPixel,
  };
}

export function unproject(point: Point, zoom: number): Coordinates {
  const unitsPerPixel = resolution(zoom);
  return unprojectFromLest({
    x: RADAR_EXTENT[0] + point.x * unitsPerPixel,
    y: RADAR_EXTENT[3] - point.y * unitsPerPixel,
  });
}

export function clampMapCenter(center: Coordinates, zoom: number, size: MapSize): Coordinates {
  const normalizedZoom = clamp(Math.round(zoom), 0, RADAR_RESOLUTIONS.length - 1);
  const worldPixels = TILE_SIZE * 2 ** normalizedZoom;
  const halfWidth = Math.min(size.width / 2, worldPixels / 2);
  const halfHeight = Math.min(size.height / 2, worldPixels / 2);
  const point = project(center, normalizedZoom);
  return unproject({
    x: clamp(point.x, halfWidth, worldPixels - halfWidth),
    y: clamp(point.y, halfHeight, worldPixels - halfHeight),
  }, normalizedZoom);
}

export function visibleTileSlots(center: Coordinates, zoom: number, size: MapSize): RadarTileSlot[] {
  if (size.width <= 0 || size.height <= 0) return [];
  const normalizedZoom = clamp(Math.round(zoom), 0, RADAR_RESOLUTIONS.length - 1);
  const projectedCenter = project(center, normalizedZoom);
  const leftEdge = projectedCenter.x - size.width / 2;
  const topEdge = projectedCenter.y - size.height / 2;
  const firstX = Math.floor(leftEdge / TILE_SIZE);
  const lastX = Math.ceil((leftEdge + size.width) / TILE_SIZE) - 1;
  const firstY = Math.floor(topEdge / TILE_SIZE);
  const lastY = Math.ceil((topEdge + size.height) / TILE_SIZE) - 1;
  const tileCount = 2 ** normalizedZoom;
  const tileSpan = TILE_SIZE * resolution(normalizedZoom);
  const slots: RadarTileSlot[] = [];

  for (let y = firstY; y <= lastY; y += 1) {
    if (y < 0 || y >= tileCount) continue;
    for (let x = firstX; x <= lastX; x += 1) {
      if (x < 0 || x >= tileCount) continue;
      const tmsY = tileCount - 1 - y;
      const minimumEasting = RADAR_EXTENT[0] + x * tileSpan;
      const minimumNorthing = RADAR_EXTENT[1] + tmsY * tileSpan;
      slots.push({
        key: `${normalizedZoom}/${x}/${y}`,
        zoom: normalizedZoom,
        x,
        y,
        tmsY,
        left: x * TILE_SIZE - leftEdge,
        top: y * TILE_SIZE - topEdge,
        bbox: [
          minimumEasting,
          minimumNorthing,
          minimumEasting + tileSpan,
          minimumNorthing + tileSpan,
        ],
      });
    }
  }
  return slots;
}

function templateUrl(template: string, slot: RadarTileSlot, time?: string): string {
  return template
    .replace("{TIME}", time ? encodeURIComponent(time) : "")
    .replace("{z}", String(slot.zoom))
    .replace("{x}", String(slot.x))
    .replace("{-y}", String(slot.tmsY));
}

export function baseMapTiles(manifest: RadarManifest, slots: RadarTileSlot[]): MapTile[] {
  return slots.map((slot) => ({ ...slot, url: templateUrl(manifest.map.baseTileUrlTemplate, slot) }));
}

export function labelMapTiles(manifest: RadarManifest, slots: RadarTileSlot[]): MapTile[] {
  return slots.map((slot) => ({ ...slot, url: templateUrl(manifest.map.labelTileUrlTemplate, slot) }));
}

function wmsTileUrl(manifest: RadarManifest, frame: RadarFrame, slot: RadarTileSlot): string {
  const layer = frame.kind === "forecast" ? manifest.map.forecast : manifest.map.observed;
  const url = new URL(manifest.map.wmsUrl);
  url.search = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: layer.layer,
    STYLES: layer.style,
    FORMAT: "image/png8",
    TRANSPARENT: "true",
    SRS: "EPSG:3301",
    BBOX: slot.bbox.join(","),
    WIDTH: String(TILE_SIZE),
    HEIGHT: String(TILE_SIZE),
    TIME: frame.time,
    TILED: "true",
    EXCEPTIONS: "application/vnd.ogc.se_xml",
  }).toString();
  return url.toString();
}

export function radarFrameTiles(
  manifest: RadarManifest,
  frame: RadarFrame,
  slots: RadarTileSlot[],
): RadarFrameTile[] {
  return slots.map((slot) => ({
    ...slot,
    url: frame.kind === "observed"
      ? templateUrl(manifest.map.observedTileUrlTemplate, slot, frame.time)
      : wmsTileUrl(manifest, frame, slot),
    fallbackUrl: frame.kind === "observed" ? wmsTileUrl(manifest, frame, slot) : null,
  }));
}

export function radarTilePlan(
  manifest: RadarManifest,
  frame: RadarFrame,
  slots: RadarTileSlot[],
): RadarTilePlan {
  const tileSetKey = slots.map((slot) => slot.key).join("|");
  return {
    id: `${frame.kind}:${frame.time}:${tileSetKey}`,
    frame,
    tileSetKey,
    tiles: radarFrameTiles(manifest, frame, slots),
  };
}

export function pointInViewport(
  coordinates: Coordinates,
  center: Coordinates,
  zoom: number,
  size: MapSize,
): Point {
  const point = project(coordinates, zoom);
  const centerPoint = project(center, zoom);
  return {
    x: size.width / 2 + point.x - centerPoint.x,
    y: size.height / 2 + point.y - centerPoint.y,
  };
}
