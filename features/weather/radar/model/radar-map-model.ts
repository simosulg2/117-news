import type { RadarFrame } from "../../../../lib/radar.ts";
import type {
  Coordinates,
  MapSize,
  MapTile,
  Point,
  RadarManifest,
} from "./radar-types.ts";

export const TILE_SIZE = 256;
const WEB_MERCATOR_LIMIT = 20_037_508.342789244;
const MAX_MERCATOR_LATITUDE = 85.05112878;
export const MIN_ZOOM = 5;
export const MAX_ZOOM = 10;
export const ZERO_POINT: Point = { x: 0, y: 0 };
export const VORU_COORDINATES: Coordinates = { latitude: 57.8463, longitude: 27.0195 };

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

export function project(coordinates: Coordinates, zoom: number): Point {
  const size = worldSize(zoom);
  const latitude = clamp(coordinates.latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  const sine = Math.sin((latitude * Math.PI) / 180);

  return {
    x: ((coordinates.longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size,
  };
}

export function unproject(point: Point, zoom: number): Coordinates {
  const size = worldSize(zoom);
  const longitude = (point.x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / size;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));

  return {
    latitude: clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE),
    longitude: ((longitude + 540) % 360) - 180,
  };
}

function worldPointToMercator(point: Point, zoom: number): Point {
  const size = worldSize(zoom);
  return {
    x: (point.x / size) * WEB_MERCATOR_LIMIT * 2 - WEB_MERCATOR_LIMIT,
    y: WEB_MERCATOR_LIMIT - (point.y / size) * WEB_MERCATOR_LIMIT * 2,
  };
}

export function visibleTiles(center: Coordinates, zoom: number, size: MapSize): MapTile[] {
  if (size.width <= 0 || size.height <= 0) return [];

  const projectedCenter = project(center, zoom);
  const leftEdge = projectedCenter.x - size.width / 2;
  const topEdge = projectedCenter.y - size.height / 2;
  const firstX = Math.floor(leftEdge / TILE_SIZE);
  const lastX = Math.floor((leftEdge + size.width) / TILE_SIZE);
  const firstY = Math.floor(topEdge / TILE_SIZE);
  const lastY = Math.floor((topEdge + size.height) / TILE_SIZE);
  const tileCount = 2 ** zoom;
  const tiles: MapTile[] = [];

  for (let tileY = firstY; tileY <= lastY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstX; tileX <= lastX; tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}/${tileX}/${tileY}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
        left: tileX * TILE_SIZE - leftEdge,
        top: tileY * TILE_SIZE - topEdge,
      });
    }
  }

  return tiles;
}

export function wmsImageUrl(
  manifest: RadarManifest,
  frame: RadarFrame,
  center: Coordinates,
  zoom: number,
  size: MapSize,
): string {
  if (size.width <= 0 || size.height <= 0) return "";

  const projectedCenter = project(center, zoom);
  const topLeft = worldPointToMercator(
    { x: projectedCenter.x - size.width / 2, y: projectedCenter.y - size.height / 2 },
    zoom,
  );
  const bottomRight = worldPointToMercator(
    { x: projectedCenter.x + size.width / 2, y: projectedCenter.y + size.height / 2 },
    zoom,
  );
  const layer = frame.kind === "forecast" ? manifest.map.forecast : manifest.map.observed;
  const url = new URL(manifest.map.wmsUrl);
  url.search = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: layer.layer,
    STYLES: layer.style,
    FORMAT: "image/png",
    TRANSPARENT: "true",
    SRS: "EPSG:3857",
    BBOX: `${topLeft.x},${bottomRight.y},${bottomRight.x},${topLeft.y}`,
    WIDTH: String(Math.min(1280, Math.max(1, Math.round(size.width)))),
    HEIGHT: String(Math.min(900, Math.max(1, Math.round(size.height)))),
    TIME: frame.time,
    EXCEPTIONS: "application/vnd.ogc.se_xml",
  }).toString();
  return url.toString();
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
