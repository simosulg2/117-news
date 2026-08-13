"use client";

import { useEffect, useRef, useState } from "react";

import { WEATHER_REFRESH_MS } from "@/features/weather/model/weather-client-model";
import type { WeatherResponse } from "@/lib/weather-types";

export function useWeatherFeed() {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const dataRef = useRef<WeatherResponse | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let activeController: AbortController | null = null;

    async function loadWeather() {
      if (inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      if (dataRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch("/api/weather", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`weather endpoint returned ${response.status}`);
        const nextData = (await response.json()) as WeatherResponse;
        if (disposed) return;
        dataRef.current = nextData;
        setData(nextData);
        setError(null);
        setRefreshError(null);
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

    void loadWeather();
    const refreshInterval = window.setInterval(() => void loadWeather(), WEATHER_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      const generatedAt = dataRef.current ? Date.parse(dataRef.current.generatedAt) : Number.NaN;
      if (!Number.isFinite(generatedAt) || Date.now() - generatedAt >= WEATHER_REFRESH_MS) void loadWeather();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [retryKey]);

  return {
    data,
    loading,
    refreshing,
    error,
    refreshError,
    retry: () => setRetryKey((value) => value + 1),
  };
}
