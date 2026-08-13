"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RatingsResponse } from "@/lib/ratings-types";

const RATINGS_REFRESH_MS = 60 * 60 * 1_000;
const RATINGS_REFRESH_CHECK_MS = 5 * 60 * 1_000;

export type RatingsFeedState = {
  data: RatingsResponse | null;
  error: string | null;
  refreshing: boolean;
  refreshError: string | null;
  refresh: () => void;
  retry: () => void;
};

export function useRatingsFeed(): RatingsFeedState {
  const [data, setData] = useState<RatingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const dataRef = useRef<RatingsResponse | null>(null);
  const fetchedAtRef = useRef(0);
  const forceRefreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let activeController: AbortController | null = null;

    async function loadRatings(force = false) {
      if (inFlight) return;
      if (!force && fetchedAtRef.current > 0 && Date.now() - fetchedAtRef.current < RATINGS_REFRESH_MS) return;

      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      if (dataRef.current) {
        setRefreshing(true);
        setRefreshError(null);
      } else {
        setError(null);
      }

      try {
        const response = await fetch("/api/ratings", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Reitingute laadimine ebaõnnestus.");
        const servedStale = response.headers.get("X-Ratings-Snapshot") === "stale-if-error";
        const nextData = (await response.json()) as RatingsResponse;
        if (disposed) return;
        dataRef.current = nextData;
        fetchedAtRef.current = Date.parse(nextData.fetchedAt) || Date.now();
        setData(nextData);
        setError(null);
        setRefreshError(servedStale ? "Allika uuendamine ebaõnnestus; kuvame viimati õnnestunud seisu." : null);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (disposed) return;
        if (dataRef.current) {
          setRefreshError("Värskendus ebaõnnestus; kuvame viimati laaditud reitinguid.");
        } else {
          setError("Reitingute allikaga ei saadud ühendust. Kontrolli ühendust ja proovi uuesti.");
        }
      } finally {
        if (activeController === controller) activeController = null;
        inFlight = false;
        if (!disposed && !controller.signal.aborted) setRefreshing(false);
      }
    }

    forceRefreshRef.current = () => void loadRatings(true);
    void loadRatings(true);
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void loadRatings();
    };
    const interval = window.setInterval(refreshWhenActive, RATINGS_REFRESH_CHECK_MS);
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);

    return () => {
      disposed = true;
      forceRefreshRef.current = null;
      activeController?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
    };
  }, [retryKey]);

  const refresh = useCallback(() => forceRefreshRef.current?.(), []);
  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  return { data, error, refreshing, refreshError, refresh, retry };
}
