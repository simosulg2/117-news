"use client";

import { useEffect, useState } from "react";

import type {
  MarketDirectionFilter,
  MarketSortOrder,
} from "../model/market-view-model";

const SETTINGS_KEY = "117-market-settings";
const DIRECTION_FILTERS = ["all", "buy", "sell", "reliable"] as const;
const SORT_ORDERS = ["absolute-gap", "buy-gap", "sell-gap", "freshest", "name"] as const;

export function useMarketPreferences() {
  const [minimumGap, setMinimumGap] = useState(1);
  const [tradeAmount, setTradeAmount] = useState(500);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<MarketDirectionFilter>("all");
  const [sortOrder, setSortOrder] = useState<MarketSortOrder>("absolute-gap");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as unknown;
      if (saved && typeof saved === "object") {
        const values = saved as Record<string, unknown>;
        if (typeof values.minimumGap === "number") setMinimumGap(Math.min(25, Math.max(0, values.minimumGap)));
        if (typeof values.tradeAmount === "number") setTradeAmount(Math.min(100_000, Math.max(100, values.tradeAmount)));
        if (typeof values.showAll === "boolean") setShowAll(values.showAll);
        if (typeof values.query === "string") setQuery(values.query.slice(0, 80));
        if (DIRECTION_FILTERS.includes(values.directionFilter as MarketDirectionFilter)) {
          setDirectionFilter(values.directionFilter as MarketDirectionFilter);
        }
        if (SORT_ORDERS.includes(values.sortOrder as MarketSortOrder)) {
          setSortOrder(values.sortOrder as MarketSortOrder);
        }
      }
    } catch {
      // Invalid local preferences safely fall back to the defaults.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        minimumGap,
        tradeAmount,
        showAll,
        query,
        directionFilter,
        sortOrder,
      }));
    } catch {
      // The dashboard remains usable if browser storage is unavailable.
    }
  }, [directionFilter, minimumGap, query, ready, showAll, sortOrder, tradeAmount]);

  return {
    minimumGap,
    tradeAmount,
    showAll,
    query,
    directionFilter,
    sortOrder,
    setMinimumGap,
    setTradeAmount,
    setShowAll,
    setQuery,
    setDirectionFilter,
    setSortOrder,
    resetFilters: () => {
      setQuery("");
      setDirectionFilter("all");
      setSortOrder("absolute-gap");
    },
  };
}
