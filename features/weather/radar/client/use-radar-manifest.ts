"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isRadarManifest,
  normalizeRadarManifest,
  radarLoadError,
} from "../model/radar-manifest-model";
import type { RadarManifest } from "../model/radar-types";

const RADAR_REFRESH_CHECK_MS = 60_000;

type ManifestLoaded = (
  manifest: RadarManifest,
  previousManifest: RadarManifest | null,
) => void;

export function useRadarManifest(onManifestLoaded: ManifestLoaded) {
  const [manifest, setManifest] = useState<RadarManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const manifestRef = useRef<RadarManifest | null>(null);
  const onManifestLoadedRef = useRef(onManifestLoaded);
  const refreshRef = useRef<((force?: boolean) => void) | null>(null);
  onManifestLoadedRef.current = onManifestLoaded;

  useEffect(() => {
    let activeController: AbortController | null = null;
    let disposed = false;
    let inFlight = false;
    let lastCheckedAt = 0;

    async function loadRadar(force = false) {
      if (inFlight) return;
      if (!force && Date.now() - lastCheckedAt < RADAR_REFRESH_CHECK_MS) return;

      inFlight = true;
      lastCheckedAt = Date.now();
      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch("/api/weather/radar", {
          cache: "no-store",
          signal: controller.signal,
        });
        const value: unknown = await response.json();
        if (!response.ok || !isRadarManifest(value)) throw new Error(radarLoadError(value));

        const nextManifest = normalizeRadarManifest(value);
        if (disposed) return;
        const previousManifest = manifestRef.current;
        manifestRef.current = nextManifest;
        onManifestLoadedRef.current(nextManifest, previousManifest);
        setManifest(nextManifest);
        setLoadError(
          response.headers.get("X-Radar-Snapshot") === "stale-if-error"
            ? "Radari uuendamine ebaõnnestus; kuvatakse viimast õnnestunud ajajoont."
            : null,
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!disposed) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Radari ajajoont ei õnnestunud laadida.",
          );
        }
      } finally {
        if (activeController === controller) activeController = null;
        inFlight = false;
        if (!disposed && !controller.signal.aborted) setLoading(false);
      }
    }

    refreshRef.current = (force = false) => void loadRadar(force);
    void loadRadar(true);
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void loadRadar();
    };
    const interval = window.setInterval(refreshWhenActive, RADAR_REFRESH_CHECK_MS);
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("pageshow", refreshWhenActive);

    return () => {
      disposed = true;
      refreshRef.current = null;
      activeController?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("pageshow", refreshWhenActive);
    };
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    refreshRef.current?.(true);
  }, []);

  return { manifest, loadError, loading, retry };
}
