"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { NewsResponse } from "@/lib/types";

const NEWS_REFRESH_MS = 5 * 60 * 1_000;
const NEWS_REFRESH_CHECK_MS = 60 * 1_000;

export function useNewsFeed() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const dataRef = useRef<NewsResponse | null>(null);
  const snapshotUpdatedAtRef = useRef(0);
  const refreshNewsRef = useRef<((force?: boolean) => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let activeController: AbortController | null = null;

    async function loadNews(force = false) {
      if (inFlight) return;
      if (
        !force
        && snapshotUpdatedAtRef.current > 0
        && Date.now() - snapshotUpdatedAtRef.current < NEWS_REFRESH_MS
      ) {
        return;
      }

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
        const response = await fetch("/api/news", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Uudiste laadimine ebaõnnestus.");
        const servedStaleSnapshot = response.headers.get("X-News-Snapshot") === "stale-if-error";
        const nextData = (await response.json()) as NewsResponse;
        if (disposed) return;
        dataRef.current = nextData;
        const snapshotUpdatedAt = Date.parse(nextData.updatedAt);
        snapshotUpdatedAtRef.current = Number.isFinite(snapshotUpdatedAt)
          ? snapshotUpdatedAt
          : Date.now();
        setData(nextData);
        setError(null);
        setRefreshError(
          servedStaleSnapshot
            ? "Uuendamine ebaõnnestus; kuvame viimati laaditud uudiseid."
            : null,
        );
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (disposed) return;
        if (dataRef.current) {
          setRefreshError("Uuendamine ebaõnnestus; kuvame viimati laaditud uudiseid.");
        } else {
          setError("Uudisvoogudega ei saadud ühendust. Kontrolli ühendust ja proovi uuesti.");
        }
      } finally {
        if (activeController === controller) activeController = null;
        inFlight = false;
        if (!disposed && !controller.signal.aborted) setRefreshing(false);
      }
    }

    refreshNewsRef.current = (force = false) => void loadNews(force);
    void loadNews();
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void loadNews();
    };
    const refreshInterval = window.setInterval(refreshWhenActive, NEWS_REFRESH_CHECK_MS);
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("pageshow", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);

    return () => {
      disposed = true;
      refreshNewsRef.current = null;
      activeController?.abort();
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("pageshow", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
    };
  }, []);

  const refreshNews = useCallback(() => {
    refreshNewsRef.current?.(true);
  }, []);

  return { data, error, refreshing, refreshError, refreshNews };
}
