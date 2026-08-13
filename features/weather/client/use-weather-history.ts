"use client";

import { useEffect, useState } from "react";

import { WEATHER_REFRESH_MS, type WeatherRange } from "@/features/weather/model/weather-client-model";
import type { WeatherHistoryResponse } from "@/lib/weather-types";

type UseWeatherHistoryOptions = {
  enabled: boolean;
  range: WeatherRange;
  selectedDate: string;
  selectedEndDate: string;
  visibleStartMs: number;
  visibleEndMs: number;
  nowMs: number;
};

export function useWeatherHistory(options: UseWeatherHistoryOptions) {
  const [extendedHistory, setExtendedHistory] = useState<WeatherHistoryResponse | null>(null);
  const [extendedHistoryScope, setExtendedHistoryScope] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const requestStartMs = Math.floor(options.visibleStartMs / WEATHER_REFRESH_MS) * WEATHER_REFRESH_MS;
  const requestEndMs = Math.floor(Math.min(options.visibleEndMs, options.nowMs) / WEATHER_REFRESH_MS) * WEATHER_REFRESH_MS;
  const scope = `${options.range}:${options.selectedDate}:${options.selectedEndDate}`;
  const matchesScope = extendedHistory !== null && extendedHistoryScope === scope;

  useEffect(() => {
    if (!options.enabled) {
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    const controller = new AbortController();
    const parameters = new URLSearchParams({
      from: new Date(requestStartMs).toISOString(),
      to: new Date(requestEndMs).toISOString(),
    });
    setHistoryLoading(true);
    setHistoryError(null);

    void fetch(`/api/weather/history?${parameters.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw new Error(`history endpoint returned ${response.status}`);
      const payload = (await response.json()) as WeatherHistoryResponse;
      if (controller.signal.aborted) return;
      setExtendedHistory(payload);
      setExtendedHistoryScope(scope);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setHistoryError("Pikema ilmaajaloo laadimine ebaõnnestus. Lühemad vaated töötavad endiselt.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setHistoryLoading(false);
    });

    return () => controller.abort();
  }, [options.enabled, requestEndMs, requestStartMs, scope]);

  const csvUrl = `/api/weather/history?${new URLSearchParams({
    from: new Date(requestStartMs).toISOString(),
    to: new Date(requestEndMs).toISOString(),
    format: "csv",
  }).toString()}`;

  return {
    extendedHistory,
    historyLoading,
    historyError,
    requestStartMs,
    requestEndMs,
    matchesScope,
    csvUrl,
  };
}
