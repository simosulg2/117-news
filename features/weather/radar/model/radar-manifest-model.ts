import type { RadarManifest } from "./radar-types.ts";

export function isRadarManifest(value: unknown): value is RadarManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<RadarManifest>;
  return (
    Array.isArray(candidate.frames) &&
    candidate.frames.length > 0 &&
    Boolean(candidate.map?.wmsUrl) &&
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

export function radarPrefetchFrameIndices(frameCount: number, selectedIndex: number): number[] {
  return [selectedIndex - 1, selectedIndex + 1].filter(
    (index) => index >= 0 && index < frameCount,
  );
}
