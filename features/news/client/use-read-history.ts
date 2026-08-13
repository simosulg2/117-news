"use client";

import { useCallback, useEffect, useState } from "react";

import {
  parseReadTimestamps,
  pruneReadTimestamps,
  READ_STORAGE_KEY,
  readKeyForItem,
  type ReadTimestamps,
} from "@/features/news/model/read-history";
import type { NewsArticle } from "@/lib/types";

export function useReadHistory() {
  const [readTimestamps, setReadTimestamps] = useState<ReadTimestamps>({});
  const [readStateLoaded, setReadStateLoaded] = useState(false);

  useEffect(() => {
    try {
      setReadTimestamps(parseReadTimestamps(localStorage.getItem(READ_STORAGE_KEY)));
    } catch {
      setReadTimestamps({});
    }
    setReadStateLoaded(true);

    function handleStorage(event: StorageEvent) {
      if (event.key !== READ_STORAGE_KEY) return;
      setReadTimestamps(parseReadTimestamps(event.newValue));
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!readStateLoaded) return;

    try {
      if (Object.keys(readTimestamps).length === 0) {
        localStorage.removeItem(READ_STORAGE_KEY);
      } else {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readTimestamps));
      }
    } catch {
      // The feed stays usable when browser storage is unavailable.
    }
  }, [readStateLoaded, readTimestamps]);

  const isItemRead = useCallback(
    (item: NewsArticle) => Object.prototype.hasOwnProperty.call(readTimestamps, readKeyForItem(item)),
    [readTimestamps],
  );

  const markItemRead = useCallback((item: NewsArticle) => {
    const key = readKeyForItem(item);
    const timestamp = Date.now();
    setReadTimestamps((current) => pruneReadTimestamps({ ...current, [key]: timestamp }, timestamp));
  }, []);

  const resetReadHistory = useCallback(() => {
    setReadTimestamps({});
  }, []);

  return {
    isItemRead,
    markItemRead,
    readCount: Object.keys(readTimestamps).length,
    readStateLoaded,
    resetReadHistory,
  };
}
