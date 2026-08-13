"use client";

import { useCallback, useEffect, useState } from "react";

import { isRadarStale, type RadarFrame } from "@/lib/radar";
import { preferredFrameIndex } from "../model/radar-manifest-model";
import type { RadarManifest } from "../model/radar-types";
import { useRadarMapControls } from "./use-radar-map-controls";
import { useRadarManifest } from "./use-radar-manifest";

const RADAR_FRESHNESS_CLOCK_MS = 30_000;
const ANIMATION_FRAME_HOLD_MS = 500;

export function useRadarController() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [opacity, setOpacity] = useState(78);
  const [layerError, setLayerError] = useState(false);
  const [activeRadarFrame, setActiveRadarFrame] = useState<RadarFrame | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());

  const handleManifestLoaded = useCallback((
    nextManifest: RadarManifest,
    previousManifest: RadarManifest | null,
  ) => {
    setFrameIndex((current) => preferredFrameIndex(
      nextManifest,
      previousManifest ?? undefined,
      current,
    ));
  }, []);
  const { manifest, loadError, loading, retry } = useRadarManifest(handleManifestLoaded);
  const map = useRadarMapControls(manifest?.map.initialZoom ?? 2, Boolean(manifest));

  useEffect(() => {
    const freshnessClock = window.setInterval(
      () => setClockMs(Date.now()),
      RADAR_FRESHNESS_CLOCK_MS,
    );
    return () => window.clearInterval(freshnessClock);
  }, []);

  const selectedFrame = manifest?.frames[frameIndex] ?? null;
  const visibleFrame = activeRadarFrame ?? selectedFrame;
  const layerLoading = Boolean(
    selectedFrame
    && !layerError
    && frameIdentity(activeRadarFrame) !== frameIdentity(selectedFrame),
  );
  const radarIsStale = Boolean(
    manifest && (manifest.stale || isRadarStale(manifest.latestObservation, clockMs)),
  );

  useEffect(() => {
    setLayerError(false);
  }, [selectedFrame?.kind, selectedFrame?.time]);

  useEffect(() => {
    if (
      !playing
      || !manifest
      || manifest.frames.length < 2
      || frameIdentity(activeRadarFrame) !== frameIdentity(selectedFrame)
    ) return;
    const nextFrame = window.setTimeout(
      () => setFrameIndex((current) => (current + 1) % manifest.frames.length),
      ANIMATION_FRAME_HOLD_MS,
    );
    return () => window.clearTimeout(nextFrame);
  }, [activeRadarFrame, manifest, playing, selectedFrame]);

  return {
    manifest, loadError, loading, retry, frameIndex, selectedFrame, visibleFrame, playing,
    opacity, ...map, layerError, layerLoading, radarIsStale, activeRadarFrame,
    previousFrame: () => {
      setPlaying(false);
      setFrameIndex((current) => Math.max(0, current - 1));
    },
    nextFrame: () => {
      setPlaying(false);
      setFrameIndex((current) => Math.min(
        (manifest?.frames.length ?? 1) - 1,
        current + 1,
      ));
    },
    togglePlaying: () => setPlaying((current) => !current),
    selectFrame: (index: number) => {
      setPlaying(false);
      setFrameIndex(index);
    },
    setOpacity,
    acceptRadarFrame: (frame: RadarFrame) => {
      if (frameIdentity(selectedFrame) !== frameIdentity(frame)) return;
      setActiveRadarFrame(frame);
      setLayerError(false);
    },
    rejectRadarFrame: (frameKey: string) => {
      if (frameIdentity(selectedFrame) !== frameKey) return;
      setLayerError(true);
      setPlaying(false);
    },
  };
}

export function frameIdentity(frame: RadarFrame | null): string {
  return frame ? `${frame.kind}:${frame.time}` : "";
}

export type RadarController = ReturnType<typeof useRadarController>;
export type ReadyRadarController = Omit<RadarController, "manifest" | "selectedFrame" | "visibleFrame"> & {
  manifest: RadarManifest;
  selectedFrame: RadarFrame;
  visibleFrame: RadarFrame;
};

export function isReadyRadarController(radar: RadarController): radar is ReadyRadarController {
  return radar.manifest !== null && radar.selectedFrame !== null && radar.visibleFrame !== null;
}
