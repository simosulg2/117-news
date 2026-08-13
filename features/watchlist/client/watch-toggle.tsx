"use client";

import { useWatchlist } from "@/features/watchlist/client/watchlist-provider";
import type { WatchEntry, WatchKind } from "@/features/watchlist/model/watchlist";

type WatchToggleProps = {
  kind: WatchKind;
  targetId: string;
  label: string;
  partyIds?: string[];
  compact?: boolean;
  idleLabel?: string;
  watchedLabel?: string;
};

export function WatchToggle({ kind, targetId, label, partyIds, compact = false, idleLabel = "Jälgi", watchedLabel = "Jälgimisel" }: WatchToggleProps) {
  const { ready, isWatched, toggle } = useWatchlist();
  const watched = ready && isWatched(kind, targetId);
  const entry: Omit<WatchEntry, "id" | "createdAt"> = { kind, targetId, label, ...(partyIds ? { partyIds } : {}) };
  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={`${watched ? "Lõpeta jälgimine" : "Jälgi"}: ${label}`}
      disabled={!ready}
      onClick={() => toggle(entry)}
      className={`${compact ? "min-h-7 px-2 text-[10px]" : "min-h-9 px-3 text-xs"} inline-flex items-center gap-1.5 border font-bold outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50 ${
        watched
          ? "border-[#245fae] bg-[#dce9fb] text-[#174b91] dark:border-signal dark:bg-[#102d49] dark:text-[#8eb9ff]"
          : "border-[#91a5b3] bg-transparent text-[#526878] hover:border-[#245fae] hover:text-[#245fae] dark:border-[#46657a] dark:text-[#91a6b5] dark:hover:text-[#7db0ff]"
      }`}
      title={`${watched ? "Lõpeta jälgimine" : "Jälgi"}: ${label}`}
    >
      <span aria-hidden="true">{watched ? "★" : "☆"}</span>
      {watched ? watchedLabel : idleLabel}
    </button>
  );
}
