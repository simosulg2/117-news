"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isRadarStale, type RadarFrame } from "@/lib/radar";
import {
  baseMapTiles,
  labelMapTiles,
  pointInViewport,
  radarTilePlan,
  visibleTileSlots,
  VORU_COORDINATES,
} from "../model/radar-map-model";
import {
  preferredFrameIndex,
  radarPrefetchFrameIndices,
} from "../model/radar-manifest-model";
import type {
  RadarManifest,
  RadarTilePlan,
} from "../model/radar-types";
import { useRadarMapControls } from "./use-radar-map-controls";
import { useRadarManifest } from "./use-radar-manifest";

const RADAR_FRESHNESS_CLOCK_MS = 30_000;
const ANIMATION_FRAME_HOLD_MS = 500;
const FRAME_SELECTION_DEBOUNCE_MS = 60;

export function useRadarController() {
  const [frameIndex, setFrameIndex] = useState(0);
  const [renderFrame, setRenderFrame] = useState<RadarFrame | null>(null);
  const [playing, setPlaying] = useState(false);
  const [opacity, setOpacity] = useState(78);
  const [layerError, setLayerError] = useState(false);
  const [activeRadarFrame, setActiveRadarFrame] = useState<RadarFrame | null>(null);
  const [activeRadarRequestId, setActiveRadarRequestId] = useState("");
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
    const freshnessClock = window.setInterval(() => setClockMs(Date.now()), RADAR_FRESHNESS_CLOCK_MS);
    return () => window.clearInterval(freshnessClock);
  }, []);

  const selectedFrame = manifest?.frames[frameIndex] ?? null;

  useEffect(() => {
    if (!selectedFrame) {
      setRenderFrame(null);
      return;
    }
    const timeout = window.setTimeout(
      () => setRenderFrame(selectedFrame),
      FRAME_SELECTION_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [selectedFrame]);

  const tileSlots = useMemo(
    () => visibleTileSlots(map.center, map.zoom, map.mapSize),
    [map.center, map.mapSize, map.zoom],
  );
  const mapTiles = useMemo(
    () => manifest ? baseMapTiles(manifest, tileSlots) : [],
    [manifest, tileSlots],
  );
  const labelTiles = useMemo(
    () => manifest ? labelMapTiles(manifest, tileSlots) : [],
    [manifest, tileSlots],
  );
  const radarPlan = useMemo<RadarTilePlan | null>(
    () => manifest && renderFrame && tileSlots.length > 0
      ? radarTilePlan(manifest, renderFrame, tileSlots)
      : null,
    [manifest, renderFrame, tileSlots],
  );
  const voruPoint = useMemo(
    () => pointInViewport(VORU_COORDINATES, map.center, map.zoom, map.mapSize),
    [map.center, map.mapSize, map.zoom],
  );
  const visibleFrame = activeRadarFrame ?? selectedFrame;
  const layerLoading = Boolean(selectedFrame && !layerError && (
    frameIdentity(renderFrame) !== frameIdentity(selectedFrame)
    || !radarPlan
    || activeRadarRequestId !== radarPlan.id
  ));
  const renderFrameIndex = manifest && renderFrame
    ? manifest.frames.findIndex((frame) => frameIdentity(frame) === frameIdentity(renderFrame))
    : -1;
  const radarPrefetchPlans = useMemo(() => {
    if (
      !manifest
      || !radarPlan
      || renderFrameIndex < 0
      || frameIdentity(selectedFrame) !== frameIdentity(renderFrame)
      || activeRadarRequestId !== radarPlan.id
    ) return [];
    return radarPrefetchFrameIndices(manifest.frames.length, renderFrameIndex, playing)
      .map((index) => radarTilePlan(manifest, manifest.frames[index], tileSlots));
  }, [activeRadarRequestId, manifest, playing, radarPlan, renderFrame, renderFrameIndex, selectedFrame, tileSlots]);
  const radarIsStale = Boolean(manifest && (manifest.stale || isRadarStale(manifest.latestObservation, clockMs)));

  useEffect(() => {
    setLayerError(false);
  }, [radarPlan?.id]);

  useEffect(() => {
    if (
      !playing
      || !manifest
      || manifest.frames.length < 2
      || frameIdentity(activeRadarFrame) !== frameIdentity(selectedFrame)
      || !radarPlan
      || activeRadarRequestId !== radarPlan.id
    ) return;
    const nextFrame = window.setTimeout(
      () => setFrameIndex((current) => (current + 1) % manifest.frames.length),
      ANIMATION_FRAME_HOLD_MS,
    );
    return () => window.clearTimeout(nextFrame);
  }, [activeRadarFrame, activeRadarRequestId, manifest, playing, radarPlan, selectedFrame]);

  return {
    manifest, loadError, loading, retry, frameIndex, selectedFrame, visibleFrame, playing,
    opacity, ...map, layerError, layerLoading, radarIsStale, mapTiles,
    radarPlan, radarPrefetchPlans, labelTiles, tileSlots, activeRadarFrame, voruPoint,
    previousFrame: () => { setPlaying(false); setFrameIndex((current) => Math.max(0, current - 1)); },
    nextFrame: () => { setPlaying(false); setFrameIndex((current) => Math.min((manifest?.frames.length ?? 1) - 1, current + 1)); },
    togglePlaying: () => setPlaying((current) => !current),
    selectFrame: (index: number) => { setPlaying(false); setFrameIndex(index); },
    setOpacity,
    acceptRadarPlan: (plan: RadarTilePlan) => {
      if (radarPlan?.id !== plan.id) return;
      setActiveRadarFrame(plan.frame);
      setActiveRadarRequestId(plan.id);
      setLayerError(false);
    },
    rejectRadarFrame: (requestId: string) => {
      if (radarPlan?.id !== requestId) return;
      setLayerError(true);
      setPlaying(false);
    },
  };
}

function frameIdentity(frame: RadarFrame | null): string {
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
