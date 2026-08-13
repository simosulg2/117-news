"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EconomyResponse } from "@/lib/economy-types";

const REFRESH_AFTER_MS = 6 * 60 * 60 * 1_000;
const CHECK_INTERVAL_MS = 30 * 60 * 1_000;

export type EconomyFeedState = {
  data: EconomyResponse | null;
  error: string | null;
  refreshError: string | null;
  refreshing: boolean;
  refresh: () => void;
  retry: () => void;
};

export function useEconomyFeed(): EconomyFeedState {
  const [data, setData] = useState<EconomyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const dataRef = useRef<EconomyResponse | null>(null);
  const loadedAtRef = useRef(0);
  const forceRefreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;

    async function load(force = false) {
      if (inFlight) return;
      if (!force && loadedAtRef.current && Date.now() - loadedAtRef.current < REFRESH_AFTER_MS) return;
      inFlight = true;
      controller = new AbortController();
      if (dataRef.current) setRefreshing(true);
      else setError(null);
      setRefreshError(null);
      try {
        const response = await fetch("/api/economy", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Majandusandmete laadimine ebaõnnestus.");
        const next = await response.json() as EconomyResponse;
        if (disposed) return;
        dataRef.current = next;
        loadedAtRef.current = Date.now();
        setData(next);
        setError(null);
        if (next.status !== "ok") setRefreshError("Osa allikaid on hilinenud või ajutiselt kättesaamatud.");
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (disposed) return;
        if (dataRef.current) setRefreshError("Uuendamine ebaõnnestus; kuvame viimati laaditud seisu.");
        else setError("Statistikaametiga ei saadud ühendust. Kontrolli ühendust ja proovi uuesti.");
      } finally {
        inFlight = false;
        if (!disposed) setRefreshing(false);
      }
    }

    forceRefreshRef.current = () => void load(true);
    void load(true);
    const whenActive = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = window.setInterval(whenActive, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", whenActive);
    window.addEventListener("focus", whenActive);
    return () => {
      disposed = true;
      forceRefreshRef.current = null;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", whenActive);
      window.removeEventListener("focus", whenActive);
    };
  }, [retryKey]);

  return {
    data,
    error,
    refreshError,
    refreshing,
    refresh: useCallback(() => forceRefreshRef.current?.(), []),
    retry: useCallback(() => setRetryKey((value) => value + 1), []),
  };
}
