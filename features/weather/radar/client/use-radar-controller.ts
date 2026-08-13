"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isRadarStale, type RadarFrame } from "@/lib/radar";
import {
  clamp,
  MAX_ZOOM,
  MIN_ZOOM,
  pointInViewport,
  project,
  unproject,
  visibleTiles,
  VORU_COORDINATES,
  wmsImageUrl,
  ZERO_POINT,
} from "../model/radar-map-model";
import {
  preferredFrameIndex,
  radarPrefetchFrameIndices,
} from "../model/radar-manifest-model";
import type {
  ActiveRadarImage,
  Coordinates,
  MapSize,
  Point,
  RadarManifest,
} from "../model/radar-types";
import { useRadarManifest } from "./use-radar-manifest";

const RADAR_FRESHNESS_CLOCK_MS = 30_000;
const ANIMATION_FRAME_HOLD_MS = 850;
const FRAME_SELECTION_DEBOUNCE_MS = 100;
const WHEEL_ZOOM_DEBOUNCE_MS = 140;

export function useRadarController() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelZoomTimeoutRef = useRef<number | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [renderFrame, setRenderFrame] = useState<RadarFrame | null>(null);
  const [playing, setPlaying] = useState(false);
  const [opacity, setOpacity] = useState(78);
  const [mapSize, setMapSize] = useState<MapSize>({ width: 0, height: 0 });
  const [center, setCenter] = useState<Coordinates>(VORU_COORDINATES);
  const [zoom, setZoom] = useState(7);
  const [dragOffset, setDragOffset] = useState<Point>(ZERO_POINT);
  const [layerError, setLayerError] = useState(false);
  const [activeRadarImage, setActiveRadarImage] = useState<ActiveRadarImage | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());

  const handleManifestLoaded = useCallback((
    nextManifest: RadarManifest,
    previousManifest: RadarManifest | null,
  ) => {
    setCenter((current) => previousManifest ? current : nextManifest.map.center);
    setZoom((current) => previousManifest ? current : nextManifest.map.initialZoom);
    setFrameIndex((current) => preferredFrameIndex(
      nextManifest,
      previousManifest ?? undefined,
      current,
    ));
  }, []);
  const { manifest, loadError, loading, retry } = useRadarManifest(handleManifestLoaded);

  useEffect(() => {
    const freshnessClock = window.setInterval(() => setClockMs(Date.now()), RADAR_FRESHNESS_CLOCK_MS);
    return () => window.clearInterval(freshnessClock);
  }, []);

  useEffect(() => () => {
    if (wheelZoomTimeoutRef.current !== null) window.clearTimeout(wheelZoomTimeoutRef.current);
  }, []);

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element) return;
    const updateSize = () => {
      const bounds = element.getBoundingClientRect();
      setMapSize({ width: Math.round(bounds.width), height: Math.round(bounds.height) });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [manifest]);

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

  const mapTiles = useMemo(() => visibleTiles(center, zoom, mapSize), [center, mapSize, zoom]);
  const mapViewKey = useMemo(
    () => `${center.latitude.toFixed(7)}:${center.longitude.toFixed(7)}:${zoom}:${mapSize.width}:${mapSize.height}`,
    [center, mapSize, zoom],
  );
  const radarUrl = useMemo(
    () => manifest && renderFrame ? wmsImageUrl(manifest, renderFrame, center, zoom, mapSize) : "",
    [center, manifest, mapSize, renderFrame, zoom],
  );
  const radarRequest = useMemo<ActiveRadarImage | null>(
    () => renderFrame && radarUrl ? { frame: renderFrame, url: radarUrl, viewKey: mapViewKey } : null,
    [mapViewKey, radarUrl, renderFrame],
  );
  const voruPoint = useMemo(
    () => pointInViewport(VORU_COORDINATES, center, zoom, mapSize),
    [center, mapSize, zoom],
  );
  const visibleRadarImage = activeRadarImage?.viewKey === mapViewKey ? activeRadarImage : null;
  const visibleFrame = visibleRadarImage?.frame ?? selectedFrame;
  const layerLoading = Boolean(selectedFrame && !layerError && (
    radarRequest?.frame.time !== selectedFrame.time
    || visibleRadarImage?.url !== radarRequest?.url
  ));
  const radarPrefetchUrls = useMemo(() => {
    if (!manifest || !radarRequest || visibleRadarImage?.url !== radarRequest.url) return [];
    return radarPrefetchFrameIndices(manifest.frames.length, frameIndex)
      .map((index) => wmsImageUrl(manifest, manifest.frames[index], center, zoom, mapSize))
      .filter((url) => url && url !== radarRequest.url);
  }, [center, frameIndex, manifest, mapSize, radarRequest, visibleRadarImage?.url, zoom]);
  const radarIsStale = Boolean(manifest && (manifest.stale || isRadarStale(manifest.latestObservation, clockMs)));

  useEffect(() => {
    setLayerError(false);
  }, [radarUrl]);

  useEffect(() => {
    if (!playing || !manifest || manifest.frames.length < 2 || !radarRequest || activeRadarImage?.url !== radarRequest.url) return;
    const nextFrame = window.setTimeout(
      () => setFrameIndex((current) => (current + 1) % manifest.frames.length),
      ANIMATION_FRAME_HOLD_MS,
    );
    return () => window.clearTimeout(nextFrame);
  }, [activeRadarImage?.url, manifest, playing, radarRequest]);

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    const centerPoint = project(center, zoom);
    setCenter(unproject({ x: centerPoint.x - dragOffset.x, y: centerPoint.y - dragOffset.y }, zoom));
    setDragOffset(ZERO_POINT);
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [center, dragOffset, zoom]);

  const cancelDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    setDragOffset(ZERO_POINT);
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const handleMapWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    wheelDeltaRef.current += event.deltaY;
    if (wheelZoomTimeoutRef.current !== null) window.clearTimeout(wheelZoomTimeoutRef.current);
    wheelZoomTimeoutRef.current = window.setTimeout(() => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      wheelZoomTimeoutRef.current = null;
      if (delta !== 0) setZoom((current) => clamp(current + (delta < 0 ? 1 : -1), MIN_ZOOM, MAX_ZOOM));
    }, WHEEL_ZOOM_DEBOUNCE_MS);
  }, []);

  const panBy = useCallback((x: number, y: number) => {
    const centerPoint = project(center, zoom);
    setCenter(unproject({ x: centerPoint.x + x, y: centerPoint.y + y }, zoom));
  }, [center, zoom]);

  const handleMapKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const pan = event.key === "ArrowLeft" ? [-64, 0]
      : event.key === "ArrowRight" ? [64, 0]
        : event.key === "ArrowUp" ? [0, -64]
          : event.key === "ArrowDown" ? [0, 64]
            : null;
    if (pan) panBy(pan[0], pan[1]);
    else if (event.key === "+" || event.key === "=") setZoom((current) => clamp(current + 1, MIN_ZOOM, MAX_ZOOM));
    else if (event.key === "-") setZoom((current) => clamp(current - 1, MIN_ZOOM, MAX_ZOOM));
    else if (event.key === "Home") {
      setCenter(VORU_COORDINATES);
      setZoom(manifest?.map.initialZoom ?? 7);
    } else return;
    event.preventDefault();
  };

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (start?.pointerId === event.pointerId) setDragOffset({ x: event.clientX - start.x, y: event.clientY - start.y });
  };
  const zoomBy = (delta: number) => setZoom((current) => clamp(current + delta, MIN_ZOOM, MAX_ZOOM));
  const resetMap = () => {
    setCenter(VORU_COORDINATES);
    setZoom(manifest?.map.initialZoom ?? 7);
  };
  return {
    manifest, loadError, loading, retry, frameIndex, selectedFrame, visibleFrame, playing,
    opacity, zoom, dragOffset, layerError, layerLoading, radarIsStale, mapTiles, mapElementRef,
    radarRequest, radarPrefetchUrls, activeRadarImage, visibleRadarImage, voruPoint, handleMapKey, handleMapWheel,
    startDrag, moveDrag, finishDrag, cancelDrag, zoomBy, resetMap,
    previousFrame: () => { setPlaying(false); setFrameIndex((current) => Math.max(0, current - 1)); },
    nextFrame: () => { setPlaying(false); setFrameIndex((current) => Math.min((manifest?.frames.length ?? 1) - 1, current + 1)); },
    togglePlaying: () => setPlaying((current) => !current),
    selectFrame: (index: number) => { setPlaying(false); setFrameIndex(index); },
    setOpacity,
    acceptRadarImage: (request: ActiveRadarImage) => {
      if (radarRequest?.url !== request.url) return;
      setActiveRadarImage(request);
      setLayerError(false);
    },
    rejectRadarImage: (request?: ActiveRadarImage) => {
      if (request && radarRequest?.url !== request.url) return;
      setLayerError(true);
      setPlaying(false);
      if (!request) setActiveRadarImage(null);
    },
  };
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
