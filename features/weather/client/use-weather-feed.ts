"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { shouldRefreshWeather } from "@/features/weather/model/weather-client-model";
import type { WeatherResponse } from "@/lib/weather-types";

const WEATHER_REFRESH_CHECK_MS = 60 * 1_000;

export function useWeatherFeed() {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const dataRef = useRef<WeatherResponse | null>(null);
  const snapshotAtRef = useRef(0);
  const refreshWeatherRef = useRef<((force?: boolean) => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let activeController: AbortController | null = null;

    async function loadWeather(force = false) {
      if (inFlight) return;
      if (!force && !shouldRefreshWeather(snapshotAtRef.current, Date.now())) return;
      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      if (dataRef.current) {
        setRefreshing(true);
        setRefreshError(null);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch("/api/weather", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`weather endpoint returned ${response.status}`);
        const servedStaleSnapshot = response.headers.get("X-Weather-Snapshot") === "stale-if-error";
        const nextData = (await response.json()) as WeatherResponse;
        if (disposed) return;
        dataRef.current = nextData;
        const snapshotAt = Date.parse(nextData.generatedAt);
        snapshotAtRef.current = Number.isFinite(snapshotAt) ? snapshotAt : Date.now();
        setData(nextData);
        setError(null);
        setRefreshError(servedStaleSnapshot
          ? "Ilmaallikate uuendamine ebaõnnestus. Kuvame viimati edukalt laaditud andmeid."
          : null);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (disposed) return;
        if (dataRef.current) {
          setRefreshError("Ilmaandmete taustvärskendus ebaõnnestus. Kuvame viimati edukalt laaditud andmeid.");
        } else {
          setError("Võru ilmaandmetega ei saadud ühendust. Radar võib sellest hoolimata töötada.");
        }
      } finally {
        if (activeController === controller) activeController = null;
        inFlight = false;
        if (!disposed && !controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    refreshWeatherRef.current = (force = false) => void loadWeather(force);
    void loadWeather(true);
    const refreshWhenActive = () => {
      if (document.visibilityState !== "visible") return;
      void loadWeather();
    };
    const refreshInterval = window.setInterval(refreshWhenActive, WEATHER_REFRESH_CHECK_MS);
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("pageshow", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);

    return () => {
      disposed = true;
      refreshWeatherRef.current = null;
      activeController?.abort();
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("pageshow", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
    };
  }, []);

  const retry = useCallback(() => {
    refreshWeatherRef.current?.(true);
  }, []);

  return {
    data,
    loading,
    refreshing,
    error,
    refreshError,
    retry,
  };
}
