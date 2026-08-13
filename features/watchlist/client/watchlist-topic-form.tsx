"use client";

import { useState, type FormEvent } from "react";
import { useWatchlist } from "./watchlist-provider";
import type { WatchKind } from "../model/watchlist";

const TOPIC_KINDS: Array<{ kind: WatchKind; label: string }> = [
  { kind: "news-query", label: "Uudise teema" },
  { kind: "riigikogu-topic", label: "Riigikogu teema" },
  { kind: "political-finance-topic", label: "Rahastamise teema" },
];

export function WatchlistTopicForm() {
  const { ready, isWatched, toggle } = useWatchlist();
  const [kind, setKind] = useState<WatchKind>("news-query");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const targetId = value.trim().replace(/\s+/g, " ");
    if (targetId.length < 2) { setMessage("Sisesta vähemalt kaks tähemärki."); return; }
    if (isWatched(kind, targetId)) { setMessage("See teema on juba jälgimisel."); return; }
    const type = TOPIC_KINDS.find((item) => item.kind === kind)?.label ?? "Teema";
    toggle({ kind, targetId, label: `${type}: ${targetId}` });
    setValue("");
    setMessage("Teema lisatud.");
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2 border-t border-[#c5d0d7] pt-3 dark:border-[#29455a]">
      <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.07em] text-[#526878] dark:text-[#8da1b0]">
        Valdkond
        <select value={kind} onChange={(event) => setKind(event.target.value as WatchKind)} className="min-h-9 border border-[#91a5b3] bg-white px-2 text-xs normal-case tracking-normal text-[#192630] outline-none focus-visible:ring-2 focus-visible:ring-signal dark:border-[#46657a] dark:bg-[#08131f] dark:text-[#e5eef4]">
          {TOPIC_KINDS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
        </select>
      </label>
      <label className="grid min-w-[14rem] flex-1 gap-1 text-[10px] font-bold uppercase tracking-[0.07em] text-[#526878] dark:text-[#8da1b0]">
        Märksõna
        <input value={value} onChange={(event) => setValue(event.target.value)} maxLength={160} placeholder="nt kaitsekulud" className="min-h-9 border border-[#91a5b3] bg-white px-2 text-xs normal-case tracking-normal text-[#192630] outline-none placeholder:text-[#718896] focus-visible:ring-2 focus-visible:ring-signal dark:border-[#46657a] dark:bg-[#08131f] dark:text-[#e5eef4]" />
      </label>
      <button type="submit" disabled={!ready} className="min-h-9 border border-[#245fae] px-3 text-xs font-bold text-[#174b91] outline-none hover:bg-[#dce9fb] focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50 dark:text-[#8eb9ff] dark:hover:bg-[#102d49]">Lisa teema</button>
      {message && <span role="status" className="w-full text-[11px] text-[#526878] dark:text-[#8da1b0]">{message}</span>}
    </form>
  );
}
