"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clamp,
  clampMapCenter,
  initialRadarZoom,
  MAX_ZOOM,
  minimumRadarZoom,
  VORU_COORDINATES,
} from "../model/radar-map-model";
import type { Coordinates, MapSize } from "../model/radar-types";

export function useRadarMapControls(initialZoom: number, active: boolean) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const initialViewAppliedRef = useRef(false);
  const [mapSize, setMapSize] = useState<MapSize>({ width: 0, height: 0 });
  const [center, setCenter] = useState<Coordinates>(VORU_COORDINATES);
  const [zoom, setZoom] = useState(initialZoom);
  const minimumZoom = minimumRadarZoom(mapSize);
  const effectiveZoom = clamp(zoom, minimumZoom, MAX_ZOOM);
  const effectiveCenter = clampMapCenter(center, effectiveZoom, mapSize);

  useEffect(() => {
    if (!active) return;
    const element = mapElementRef.current;
    if (!element) return;
    const updateSize = () => {
      const bounds = element.getBoundingClientRect();
      const nextSize = {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
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

  const zoomBy = useCallback(
    (delta: number) => setZoom((current) => clamp(current + delta, minimumZoom, MAX_ZOOM)),
    [minimumZoom],
  );

  const syncMapView = useCallback((nextCenter: Coordinates, nextZoom: number) => {
    const safeZoom = clamp(Math.round(nextZoom), minimumZoom, MAX_ZOOM);
    setZoom(safeZoom);
    setCenter(clampMapCenter(nextCenter, safeZoom, mapSize));
  }, [mapSize, minimumZoom]);

  const resetMap = useCallback(() => {
    setCenter(VORU_COORDINATES);
    setZoom(initialRadarZoom(mapSize.width, initialZoom));
  }, [initialZoom, mapSize.width]);

  return {
    mapElementRef,
    center: effectiveCenter,
    zoom: effectiveZoom,
    minimumZoom,
    zoomBy,
    resetMap,
    syncMapView,
  };
}
