"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  WATCHLIST_STORAGE_KEY, addWatch, emptyWatchlist, parseStoredWatchlist, parseWatchlistImport, removeWatch,
  clearWatchHistory, markWatchEventSeen, watchId, type WatchableEvent, type WatchEntry, type WatchKind, type WatchlistDocument,
} from "@/features/watchlist/model/watchlist";

type NewWatch = Omit<WatchEntry, "id" | "createdAt">;
type WatchlistContextValue = {
  document: WatchlistDocument;
  ready: boolean;
  isWatched: (kind: WatchKind, targetId: string) => boolean;
  toggle: (entry: NewWatch) => void;
  replaceFromJson: (json: string) => boolean;
  markSeen: (events: readonly WatchableEvent[]) => void;
  clearSeen: () => void;
  clear: () => void;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [document, setDocument] = useState<WatchlistDocument>(emptyWatchlist);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDocument(parseStoredWatchlist(localStorage.getItem(WATCHLIST_STORAGE_KEY)));
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === WATCHLIST_STORAGE_KEY) setDocument(parseStoredWatchlist(event.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: WatchlistDocument) => {
    setDocument(next);
    try { localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next)); } catch {
      // In-memory controls remain useful if browser storage is blocked or full.
    }
  }, []);

  const isWatched = useCallback((kind: WatchKind, targetId: string) =>
    document.entries.some((entry) => entry.id === watchId(kind, targetId)), [document.entries]);

  const toggle = useCallback((entry: NewWatch) => {
    const watched = document.entries.some((item) => item.id === watchId(entry.kind, entry.targetId));
    persist(watched ? removeWatch(document, entry.kind, entry.targetId) : addWatch(document, entry));
  }, [document, persist]);

  const replaceFromJson = useCallback((json: string) => {
    const imported = parseWatchlistImport(json);
    if (!imported) return false;
    persist(imported);
    return true;
  }, [persist]);

  const clear = useCallback(() => persist(emptyWatchlist()), [persist]);
  const clearSeen = useCallback(() => persist(clearWatchHistory(document)), [document, persist]);
  const markSeen = useCallback((events: readonly WatchableEvent[]) => {
    persist(events.reduce((current, event) => markWatchEventSeen(current, event), document));
  }, [document, persist]);
  const value = useMemo(
    () => ({ document, ready, isWatched, toggle, replaceFromJson, markSeen, clearSeen, clear }),
    [document, ready, isWatched, toggle, replaceFromJson, markSeen, clearSeen, clear],
  );
  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const value = useContext(WatchlistContext);
  if (!value) throw new Error("useWatchlist must be used inside WatchlistProvider");
  return value;
}
