"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  clamp,
  clampMapCenter,
  initialRadarZoom,
  MAX_ZOOM,
  minimumRadarZoom,
  project,
  unproject,
  VORU_COORDINATES,
  ZERO_POINT,
} from "../model/radar-map-model";
import type { Coordinates, MapSize, Point } from "../model/radar-types";

const WHEEL_ZOOM_DEBOUNCE_MS = 140;

export function useRadarMapControls(initialZoom: number, active: boolean) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelZoomTimeoutRef = useRef<number | null>(null);
  const initialViewAppliedRef = useRef(false);
  const [mapSize, setMapSize] = useState<MapSize>({ width: 0, height: 0 });
  const [center, setCenter] = useState<Coordinates>(VORU_COORDINATES);
  const [zoom, setZoom] = useState(initialZoom);
  const [dragOffset, setDragOffset] = useState<Point>(ZERO_POINT);
  const minimumZoom = minimumRadarZoom(mapSize);
  const effectiveZoom = clamp(zoom, minimumZoom, MAX_ZOOM);
  const effectiveCenter = clampMapCenter(center, effectiveZoom, mapSize);

  useEffect(() => () => {
    if (wheelZoomTimeoutRef.current !== null) window.clearTimeout(wheelZoomTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!active) return;
    const element = mapElementRef.current;
    if (!element) return;
    const updateSize = () => {
      const bounds = element.getBoundingClientRect();
      const nextSize = { width: Math.round(bounds.width), height: Math.round(bounds.height) };
      setMapSize(nextSize);
      if (!initialViewAppliedRef.current && nextSize.width > 0) {
        setZoom(initialRadarZoom(nextSize.width, initialZoom));
        initialViewAppliedRef.current = true;
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, initialZoom]);

  useEffect(() => {
    if (zoom !== effectiveZoom) setZoom(effectiveZoom);
    if (
      Math.abs(center.latitude - effectiveCenter.latitude) > 1e-8
      || Math.abs(center.longitude - effectiveCenter.longitude) > 1e-8
    ) setCenter(effectiveCenter);
  }, [center, effectiveCenter, effectiveZoom, zoom]);

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const point = project(effectiveCenter, effectiveZoom);
    setCenter(clampMapCenter(unproject({
      x: point.x - dragOffset.x,
      y: point.y - dragOffset.y,
    }, effectiveZoom), effectiveZoom, mapSize));
    setDragOffset(ZERO_POINT);
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [dragOffset, effectiveCenter, effectiveZoom, mapSize]);

  const panBy = useCallback((x: number, y: number) => {
    const point = project(effectiveCenter, effectiveZoom);
    setCenter(clampMapCenter(
      unproject({ x: point.x + x, y: point.y + y }, effectiveZoom),
      effectiveZoom,
      mapSize,
    ));
  }, [effectiveCenter, effectiveZoom, mapSize]);

  const zoomBy = useCallback(
    (delta: number) => setZoom((current) => clamp(current + delta, minimumZoom, MAX_ZOOM)),
    [minimumZoom],
  );

  const handleMapWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    wheelDeltaRef.current += event.deltaY;
    if (wheelZoomTimeoutRef.current !== null) window.clearTimeout(wheelZoomTimeoutRef.current);
    wheelZoomTimeoutRef.current = window.setTimeout(() => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      wheelZoomTimeoutRef.current = null;
      if (delta !== 0) zoomBy(delta < 0 ? 1 : -1);
    }, WHEEL_ZOOM_DEBOUNCE_MS);
  }, [zoomBy]);

  const handleMapKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const pan = event.key === "ArrowLeft" ? [-64, 0]
      : event.key === "ArrowRight" ? [64, 0]
        : event.key === "ArrowUp" ? [0, -64]
          : event.key === "ArrowDown" ? [0, 64]
            : null;
    if (pan) panBy(pan[0], pan[1]);
    else if (event.key === "+" || event.key === "=") zoomBy(1);
    else if (event.key === "-") zoomBy(-1);
    else if (event.key === "Home") resetMap();
    else return;
    event.preventDefault();
  };

  const resetMap = () => {
    setCenter(VORU_COORDINATES);
    setZoom(initialRadarZoom(mapSize.width, initialZoom));
  };

  return {
    mapElementRef, mapSize, center: effectiveCenter, zoom: effectiveZoom, minimumZoom,
    dragOffset, handleMapKey, handleMapWheel, finishDrag, zoomBy, resetMap,
    startDrag: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    moveDrag: (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      if (start?.pointerId === event.pointerId) setDragOffset({ x: event.clientX - start.x, y: event.clientY - start.y });
    },
    cancelDrag: (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      setDragOffset(ZERO_POINT);
      dragStartRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
  };
}
