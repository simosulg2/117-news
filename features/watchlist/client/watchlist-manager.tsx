"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useWatchlist } from "@/features/watchlist/client/watchlist-provider";
import { WatchToggle } from "@/features/watchlist/client/watch-toggle";
import { WatchlistTopicForm } from "@/features/watchlist/client/watchlist-topic-form";

export function WatchlistManager() {
  const { document, ready, replaceFromJson, clear } = useWatchlist();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = "117-watchlists.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || file.size > 250_000) {
      if (file) setMessage("Fail on liiga suur.");
      return;
    }
    setMessage(replaceFromJson(await file.text()) ? "Jälgimised imporditud." : "Fail ei ole kehtiv 117.ee jälgimisfail.");
  };

  return (
    <section aria-labelledby="watchlist-heading" className="border border-[#9fb2c0] bg-[#f4f7f9] p-3 dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="watchlist-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Minu jälgimised</h2>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#526878] dark:text-[#8da1b0]">
            {ready ? `${document.entries.length} jälgimist selles brauseris.` : "Laadin brauseri jälgimisi."} Andmed püsivad ainult siin seadmes; localStorage ei ole krüpteeritud ja on nähtav sama brauseriprofiili kasutajatele.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportData} disabled={!ready} className="min-h-9 border border-[#718896] px-3 text-xs font-bold text-[#405767] outline-none hover:border-[#245fae] focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50 dark:border-[#58768b] dark:text-[#a9b7c2]">Ekspordi</button>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={!ready} className="min-h-9 border border-[#718896] px-3 text-xs font-bold text-[#405767] outline-none hover:border-[#245fae] focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50 dark:border-[#58768b] dark:text-[#a9b7c2]">Impordi</button>
          <button type="button" onClick={() => { clear(); setMessage("Jälgimised kustutatud."); }} disabled={!ready || document.entries.length === 0} className="min-h-9 border border-[#9f6670] px-3 text-xs font-bold text-[#8d2d3a] outline-none hover:border-[#9d2733] focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50 dark:text-[#ff929d]">Kustuta kõik</button>
          <input ref={inputRef} type="file" accept="application/json,.json" onChange={importData} className="sr-only" aria-label="Impordi jälgimisfail" />
        </div>
      </div>
      <div className="mt-3"><WatchToggle kind="economy-release" targetId="official-release" label="Uued ametlikud majandusnäitajad" compact idleLabel="Jälgi majandusväljalaskeid" watchedLabel="Majandusväljalasked jälgimisel" /></div>
      <WatchlistTopicForm />
      {document.entries.length > 0 && <details className="mt-3 border-t border-[#c5d0d7] pt-3 dark:border-[#29455a]"><summary className="cursor-pointer text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-signal">Halda salvestatud jälgimisi ({document.entries.length})</summary><ul className="mt-2 grid gap-2 sm:grid-cols-2">{document.entries.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-2 border border-[#c5d0d7] px-2 py-1 dark:border-[#29455a]"><span className="min-w-0 truncate text-[11px] text-[#405767] dark:text-[#a9b7c2]">{entry.label}</span><WatchToggle kind={entry.kind} targetId={entry.targetId} label={entry.label} partyIds={entry.partyIds} compact watchedLabel="Eemalda" /></li>)}</ul></details>}
      {message && <p role="status" className="mt-2 text-xs font-semibold text-[#245fae] dark:text-[#7db0ff]">{message}</p>}
    </section>
  );
}
