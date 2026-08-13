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
  previousTime?: string,
): number {
  if (previousTime) {
    const preservedIndex = manifest.frames.findIndex((frame) => frame.time === previousTime);
    if (preservedIndex >= 0) return preservedIndex;
  }
  return Math.max(0, manifest.frames.findLastIndex((frame) => frame.kind === "observed"));
}
