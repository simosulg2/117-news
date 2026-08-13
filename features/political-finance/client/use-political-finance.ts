"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PoliticalFinanceResponse, PoliticalFinanceUnavailableResponse } from "../../../lib/political-finance-types";

export function usePoliticalFinance() {
  const [data, setData] = useState<PoliticalFinanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/political-finance", { cache: "no-store" });
      const body = await response.json() as PoliticalFinanceResponse | PoliticalFinanceUnavailableResponse;
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "Rahastamisandmete laadimine ebaõnnestus.");
      }
      if (currentRequest === requestId.current) setData(body);
    } catch (cause) {
      if (currentRequest === requestId.current) {
        setError(cause instanceof Error ? cause.message : "Rahastamisandmete laadimine ebaõnnestus.");
      }
    } finally {
      if (currentRequest === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  return { data, error, refreshing, refresh: load };
}
