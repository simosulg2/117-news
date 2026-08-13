"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { NowCardSection } from "@/features/now/client/now-card-section";
import { NowPageFrame } from "@/features/now/client/now-page-frame";
import { READ_STORAGE_KEY, parseReadTimestamps, readKeyForLink, type ReadTimestamps } from "@/features/news/model/read-history";
import { NOW_SEEN_STORAGE_KEY, emptyNowSeenState, isNowCardNew, markNowCardsSeen, parseNowSeenState } from "@/features/now/model/seen-state";
import { personalizedNowCards } from "@/features/now/model/personalize-now";
import { useClock } from "@/features/shell/client/use-clock";
import { usePageTheme } from "@/features/shell/client/use-page-theme";
import { useWatchlist } from "@/features/watchlist/client/watchlist-provider";
import { WatchlistManager } from "@/features/watchlist/client/watchlist-manager";
import { isNewWatchMatch, watchMatchesEvent, watchTracksEvent, type WatchableEvent } from "@/features/watchlist/model/watchlist";
import type { NowCard as NowCardType, NowResponse } from "@/lib/now-types";

function watchEvent(card: NowCardType): WatchableEvent {
  return { id: card.id, revisionId: card.revisionId, kind: card.eventKind, entityIds: card.entityIds, text: `${card.headline} ${card.detail}`, crossedThreshold: card.crossedThreshold, hasMajority: card.hasMajority, majorityChanged: card.majorityChanged };
}

export function NowPortal() {
  const [data, setData] = useState<NowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
  const [newWatchIds, setNewWatchIds] = useState<Set<string>>(new Set());
  const [readNews, setReadNews] = useState<ReadTimestamps>({});
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock();
  const watchlist = useWatchlist();
  const personalizedCards = useMemo(
    () => data ? personalizedNowCards(data.cards, watchlist.document.entries) : [],
    [data, watchlist.document.entries],
  );
  const displayedCards = useMemo(
    () => [...(data?.cards ?? []), ...personalizedCards].sort((left, right) => right.priority - left.priority),
    [data, personalizedCards],
  );
  const personalizationKey = personalizedCards.map((card) => `${card.id}:${card.revisionId}`).join("|");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/now", { cache: "no-store" });
      if (!response.ok) throw new Error("Praegu ei vastanud");
      setData(await response.json() as NowResponse);
      setError(null);
    } catch { setError("Praegu ülevaadet ei saanud laadida."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refresh = () => setReadNews(parseReadTimestamps(localStorage.getItem(READ_STORAGE_KEY)));
    refresh();
    const onStorage = (event: StorageEvent) => { if (event.key === READ_STORAGE_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!data || !watchlist.ready) return;
    const seen = parseNowSeenState(localStorage.getItem(NOW_SEEN_STORAGE_KEY));
    setNewCardIds(new Set(data.cards.filter((card) => isNowCardNew(seen, card)).map((card) => card.id)));
    const events = displayedCards.map(watchEvent);
    setNewWatchIds(new Set(displayedCards.filter((card, index) => isNewWatchMatch(watchlist.document, events[index])).map((card) => card.id)));
    const next = markNowCardsSeen(seen, data.cards);
    try { localStorage.setItem(NOW_SEEN_STORAGE_KEY, JSON.stringify(next)); } catch { /* Local markers are optional. */ }
    watchlist.markSeen(events.filter((event) => watchlist.document.entries.some((watch) => watchMatchesEvent(watch, event))));
    // The loaded watchlist snapshot is intentionally evaluated once per successful response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, watchlist.ready, personalizationKey]);

  const watchedCards = useMemo(() => displayedCards.filter((card) => {
    const event = watchEvent(card);
    return watchlist.document.entries.some((watch) => watchTracksEvent(watch, event));
  }), [displayedCards, watchlist.document.entries]);
  const watchedIds = new Set(watchedCards.map((card) => card.id));
  const otherCards = displayedCards.filter((card) => !watchedIds.has(card.id));
  const available = data?.sources.filter((source) => source.status !== "unavailable").length ?? 0;
  const total = data?.sources.length ?? 6;
  const healthy = Boolean(data?.sources.every((source) => source.status === "ok"));
  const cardIsRead = (card: NowCardType) => card.area === "news"
    && readKeyForLink(card.sourceUrl, card.id.replace(/^news:/, "")) in readNews;

  const markAllSeen = () => {
    if (!data) return;
    try { localStorage.setItem(NOW_SEEN_STORAGE_KEY, JSON.stringify(markNowCardsSeen(emptyNowSeenState(), data.cards))); } catch { /* Optional. */ }
    watchlist.markSeen(displayedCards.map(watchEvent));
    setNewCardIds(new Set());
    setNewWatchIds(new Set());
  };

  const resetSeen = () => {
    try { localStorage.removeItem(NOW_SEEN_STORAGE_KEY); } catch { /* Optional. */ }
    watchlist.clearSeen();
    setNewCardIds(new Set());
    setNewWatchIds(new Set());
  };

  return (
    <NowPageFrame theme={theme} now={now} sourceCount={data ? { available, total, healthy } : null} onToggleTheme={toggleTheme} onMarkAllSeen={markAllSeen} onResetSeen={resetSeen}>
      <main id="now-main" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-12 pt-4 outline-none">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-[#9fb2c0] pb-3 dark:border-[#35536a]">
          <div><h1 className="text-xl font-black text-[#192630] dark:text-[#e5eef4]">Praegu</h1><p className="mt-1 text-xs text-[#526878] dark:text-[#8da1b0]">Olulised muutused sinu töölaudadest, ilma automaatse arvamuseta.</p></div>
          {data && <button type="button" onClick={() => void load()} disabled={refreshing} className="min-h-9 border border-[#718896] px-3 text-xs font-bold text-[#405767] outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-60 dark:text-[#a9b7c2]">{refreshing ? "Värskendan…" : "Värskenda"}</button>}
        </div>
        {loading && <div className="grid gap-3 md:grid-cols-2"><div className="skeleton h-44" /><div className="skeleton h-44" /></div>}
        {error && !data && <div role="alert" className="border border-[#9d762f] p-4 text-sm text-[#805818] dark:text-[#efb860]">{error} <button type="button" onClick={() => void load()} className="ml-2 font-bold underline">Proovi uuesti</button></div>}
        {error && data && <p role="alert" className="mb-3 border border-[#9d762f] px-3 py-2 text-xs text-[#805818] dark:text-[#efb860]">Värskendamine ebaõnnestus; kuvame viimast ülevaadet.</p>}
        {data && (
          <div className="space-y-4">
            {data.sources.some((source) => source.status !== "ok") && <p role="status" className="border border-[#9d762f] px-3 py-2 text-xs text-[#805818] dark:text-[#efb860]">Mõni allikas on vana või kättesaamatu; ülejäänud kaardid töötavad.</p>}
            {watchedCards.length > 0 && <NowCardSection id="watched-now-heading" title="Jälgitavad" cards={watchedCards} newCardIds={newCardIds} newWatchIds={newWatchIds} isRead={cardIsRead} watched />}
            <NowCardSection id="all-now-heading" title={watchedCards.length > 0 ? "Ülejäänud muutused" : "Hetkeülevaade"} cards={otherCards} newCardIds={newCardIds} newWatchIds={newWatchIds} isRead={cardIsRead} emptyText="Uusi ülevaatekaarte pole." />
            <WatchlistManager />
          </div>
        )}
      </main>
    </NowPageFrame>
  );
}
