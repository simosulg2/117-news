import type { RadarFrame } from "../../../../lib/radar.ts";
import {
  baseMapTiles,
  labelMapTiles,
  RADAR_EXTENT,
  RADAR_RESOLUTIONS,
  radarFrameTiles,
  TILE_SIZE,
} from "./radar-map-model.ts";
import type { RadarManifest, RadarTileSlot } from "./radar-types.ts";

export type OpenLayersTileCoordinate = readonly number[];
export type RadarMapTileKind = "base" | "labels";

export function radarSourceKey(frame: RadarFrame): string {
  return `${frame.kind}:${frame.time}`;
}

export function openLayersTileSlot(
  coordinate: OpenLayersTileCoordinate | null,
): RadarTileSlot | null {
  if (!coordinate) return null;
  if (coordinate.length !== 3) return null;
  const [zoom, x, y] = coordinate;
  if (![zoom, x, y].every(Number.isInteger)) return null;
  if (zoom < 0 || zoom >= RADAR_RESOLUTIONS.length) return null;
  const tileCount = 2 ** zoom;
  if (x < 0 || y < 0 || x >= tileCount || y >= tileCount) return null;

  const tmsY = tileCount - 1 - y;
  const tileSpan = TILE_SIZE * RADAR_RESOLUTIONS[zoom];
  const minimumEasting = RADAR_EXTENT[0] + x * tileSpan;
  const minimumNorthing = RADAR_EXTENT[1] + tmsY * tileSpan;
  return {
    key: `${zoom}/${x}/${y}`,
    zoom,
    x,
    y,
    tmsY,
    left: x * TILE_SIZE,
    top: y * TILE_SIZE,
    bbox: [
      minimumEasting,
      minimumNorthing,
      minimumEasting + tileSpan,
      minimumNorthing + tileSpan,
    ],
  };
}

export function radarSourceTileUrl(
  manifest: RadarManifest,
  frame: RadarFrame,
  coordinate: OpenLayersTileCoordinate | null,
): string | undefined {
  const slot = openLayersTileSlot(coordinate);
  return slot ? radarFrameTiles(manifest, frame, [slot])[0].url : undefined;
}

export function radarSourceFallbackUrl(
  manifest: RadarManifest,
  frame: RadarFrame,
  coordinate: OpenLayersTileCoordinate | null,
): string | null {
  const slot = openLayersTileSlot(coordinate);
  return slot ? radarFrameTiles(manifest, frame, [slot])[0].fallbackUrl : null;
}

export function mapSourceTileUrl(
  manifest: RadarManifest,
  kind: RadarMapTileKind,
  coordinate: OpenLayersTileCoordinate | null,
): string | undefined {
  const slot = openLayersTileSlot(coordinate);
  if (!slot) return undefined;
  return kind === "base"
    ? baseMapTiles(manifest, [slot])[0].url
    : labelMapTiles(manifest, [slot])[0].url;
}
