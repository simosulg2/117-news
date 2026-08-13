import {
  OFFICIAL_RADAR_BASE_TILE_URL,
  OFFICIAL_RADAR_LABEL_TILE_URL,
  OFFICIAL_RADAR_OBSERVED_TILE_URL,
  OFFICIAL_RADAR_WMS_URL,
} from "../../../../lib/radar.ts";
import type { RadarManifest } from "./radar-types.ts";

export function isRadarManifest(value: unknown): value is RadarManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<RadarManifest>;
  return (
    Array.isArray(candidate.frames) &&
    candidate.frames.length > 0 &&
    candidate.map?.projection === "EPSG:3301" &&
    candidate.map?.wmsUrl === OFFICIAL_RADAR_WMS_URL &&
    candidate.map?.baseTileUrlTemplate === OFFICIAL_RADAR_BASE_TILE_URL &&
    candidate.map?.labelTileUrlTemplate === OFFICIAL_RADAR_LABEL_TILE_URL &&
    candidate.map?.observedTileUrlTemplate === OFFICIAL_RADAR_OBSERVED_TILE_URL &&
    Boolean(candidate.source?.pageUrl)
  );
}

export function normalizeRadarManifest(manifest: RadarManifest): RadarManifest {
  const notices = Array.isArray(manifest.notices)
    ? manifest.notices.filter((notice): notice is string => typeof notice === "string").slice(0, 6)
    : [];
  return {
    ...manifest,
    degraded: Boolean(manifest.degraded) || notices.length > 0,
    notices,
  };
}

export function radarLoadError(value: unknown): string {
  return value && typeof value === "object" && "error" in value && typeof value.error === "string"
    ? value.error
    : "Radari ajajoont ei õnnestunud laadida.";
}

export function preferredFrameIndex(
  manifest: RadarManifest,
  previousManifest?: RadarManifest,
  previousIndex = -1,
): number {
  const latestObservedIndex = Math.max(
    0,
    manifest.frames.findLastIndex((frame) => frame.kind === "observed"),
  );
  const previousFrame = previousManifest?.frames[previousIndex];

  if (previousFrame?.time === previousManifest?.latestObservation) {
    const nextLatestIndex = manifest.frames.findIndex(
      (frame) => frame.time === manifest.latestObservation,
    );
    return nextLatestIndex >= 0 ? nextLatestIndex : latestObservedIndex;
  }

  if (previousFrame) {
    const preservedIndex = manifest.frames.findIndex(
      (frame) => frame.time === previousFrame.time,
    );
    if (preservedIndex >= 0) return preservedIndex;
  }

  return latestObservedIndex;
}

export function radarPrefetchFrameIndices(
  frameCount: number,
  selectedIndex: number,
  playing = false,
): number[] {
  if (frameCount <= 1 || selectedIndex < 0 || selectedIndex >= frameCount) return [];
  const candidates = playing
    ? [(selectedIndex + 1) % frameCount, (selectedIndex + 2) % frameCount]
    : [(selectedIndex + 1) % frameCount, (selectedIndex - 1 + frameCount) % frameCount];
  return candidates.filter(
    (index, position) => index !== selectedIndex && candidates.indexOf(index) === position,
  );
}
