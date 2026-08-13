"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RiigikoguBillDetail,
  RiigikoguOverviewResponse,
  RiigikoguUnavailableResponse,
  RiigikoguVoteDetail,
} from "@/lib/riigikogu-types";

type Feed = {
  data: RiigikoguOverviewResponse | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
};

const REFRESH_INTERVAL_MS = 5 * 60_000;

export function useRiigikoguFeed(): Feed {
  const [data, setData] = useState<RiigikoguOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const forceRefreshRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let controller: AbortController | null = null;
    let checkedAt = 0;

    async function load(force = false) {
      if (inFlight || (!force && checkedAt && Date.now() - checkedAt < REFRESH_INTERVAL_MS)) return;
      inFlight = true;
      checkedAt = Date.now();
      controller = new AbortController();
      setRefreshing(true);
      setError(null);
      try {
        const response = await fetch("/api/riigikogu", { cache: "no-store", signal: controller.signal });
        const body = await response.json() as RiigikoguOverviewResponse | RiigikoguUnavailableResponse;
        if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Laadimine ebaõnnestus");
        if (!disposed) setData(body);
      } catch (reason) {
        if (controller.signal.aborted || disposed) return;
        setError(reason instanceof Error ? reason.message : "Laadimine ebaõnnestus");
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
    const interval = window.setInterval(whenActive, REFRESH_INTERVAL_MS);
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
  }, []);
  return {
    data,
    error,
    loading: !data && !error,
    refreshing,
    refresh: useCallback(() => forceRefreshRef.current?.(), []),
  };
}

export function useRiigikoguDetail<T extends RiigikoguVoteDetail | RiigikoguBillDetail>(
  kind: "votes" | "bills",
  id: string | null,
): { data: T | null; error: string | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null); setError(null);
    if (!id) return;
    const controller = new AbortController();
    void fetch(`/api/riigikogu/${kind}/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as T | RiigikoguUnavailableResponse;
        if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Detaili laadimine ebaõnnestus");
        setData(body);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Detaili laadimine ebaõnnestus");
      });
    return () => controller.abort();
  }, [id, kind]);
  return { data, error, loading: id !== null && !data && !error };
}
