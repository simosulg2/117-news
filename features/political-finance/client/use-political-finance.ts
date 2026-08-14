"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PoliticalFinanceResponse, PoliticalFinanceUnavailableResponse } from "../../../lib/political-finance-types";

const POLITICAL_FINANCE_REFRESH_MS = 6 * 60 * 60_000;
const POLITICAL_FINANCE_REFRESH_CHECK_MS = 5 * 60_000;

export function usePoliticalFinance() {
  const [data, setData] = useState<PoliticalFinanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const fetchedAt = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(async (force = false) => {
    if (inFlight.current) return;
    if (!force && fetchedAt.current > 0 && Date.now() - fetchedAt.current < POLITICAL_FINANCE_REFRESH_MS) return;
    inFlight.current = true;
    const currentRequest = ++requestId.current;
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/political-finance", { cache: "no-store" });
      const body = await response.json() as PoliticalFinanceResponse | PoliticalFinanceUnavailableResponse;
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "Rahastamisandmete laadimine ebaõnnestus.");
      }
      if (currentRequest === requestId.current) {
        fetchedAt.current = Date.now();
        setData(body);
      }
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(cause instanceof Error ? cause.message : "Rahastamisandmete laadimine ebaõnnestus.");
      }
    } finally {
      inFlight.current = false;
      if (currentRequest === requestId.current) setRefreshing(false);
    }
  }, []);
  const refresh = useCallback(() => { void load(true); }, [load]);

  useEffect(() => {
    void load(true);
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void load();
    };
    const interval = window.setInterval(refreshWhenActive, POLITICAL_FINANCE_REFRESH_CHECK_MS);
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("pageshow", refreshWhenActive);
    return () => {
      requestId.current += 1;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("pageshow", refreshWhenActive);
    };
  }, [load]);

  return { data, error, refreshing, refresh };
}
