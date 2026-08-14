"use client";

import { useState } from "react";
import { AgendaView } from "./agenda-view";
import { BillsView } from "./bills-view";
import { dateTimeFormatter } from "./riigikogu-formatters";
import { FactionStrip } from "./faction-strip";
import { RiigikoguPageFrame } from "./riigikogu-page-frame";
import { useRiigikoguDetail, useRiigikoguFeed } from "./use-riigikogu-feed";
import { VotesView } from "./votes-view";
import { useClock } from "@/features/shell/client/use-clock";
import { usePageTheme } from "@/features/shell/client/use-page-theme";
import { riigikoguMembershipLabel } from "@/features/riigikogu/model/membership-label";
import type { RiigikoguBillDetail, RiigikoguVoteDetail } from "@/lib/riigikogu-types";

type View = "today" | "votes" | "bills";
const views: Array<{ id: View; label: string }> = [
  { id: "today", label: "Täna" }, { id: "votes", label: "Hääletused" }, { id: "bills", label: "Eelnõud" },
];

export function RiigikoguPortalClient() {
  const feed = useRiigikoguFeed();
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock();
  const [view, setView] = useState<View>("today");
  const [voteId, setVoteId] = useState<string | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const vote = useRiigikoguDetail<RiigikoguVoteDetail>("votes", voteId);
  const bill = useRiigikoguDetail<RiigikoguBillDetail>("bills", billId);
  const healthy = feed.data?.state === "ok";
  const membershipLabel = riigikoguMembershipLabel(feed.data?.membership ?? null);
  const sourceText = feed.data ? (feed.data.state === "ok" ? "4/4 allikat" : `${4 - feed.data.unavailable.length}/4 allikat`) : "—/4 allikat";

  return <RiigikoguPageFrame theme={theme} now={now} sourceHealthy={healthy} sourceText={sourceText} onToggleTheme={toggleTheme}>
    <main id="riigikogu-main" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-12 pt-4 outline-none sm:px-5 lg:px-7">
      <section className="mb-4 border border-[#b7c5cf] bg-white dark:border-[#263d50] dark:bg-[#0b1926]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d5dfe6] px-4 py-3 dark:border-[#263d50]">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-signal">{membershipLabel} · ametlikud andmed</p><h1 className="mt-1 text-2xl font-black tracking-tight">Riigikogu töölaud</h1><p className="mt-1 text-sm text-[#657b8c] dark:text-[#9bb0bf]">Päevakord, hiljutised hääletused ja menetluses eelnõud ühes vaates.</p></div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-right text-[10px] text-[#718696]">
            {feed.data && <div><p>{feed.data.factions.reduce((sum, faction) => sum + faction.memberCount, 0)} aktiivset liiget</p><p>Allikas loetud {dateTimeFormatter.format(new Date(feed.data.attribution.retrievedAt))}</p></div>}
            <button type="button" onClick={feed.refresh} disabled={feed.refreshing} className="min-h-8 border border-[#718896] px-3 text-xs font-bold text-[#405767] outline-none hover:border-[#245fae] focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-wait disabled:opacity-60 dark:border-[#58768b] dark:text-[#a9b7c2]">
              {feed.refreshing ? "Värskendan…" : "Värskenda"}
            </button>
          </div>
        </div>
        {feed.data && <FactionStrip factions={feed.data.factions} membership={feed.data.membership} />}
        <div aria-label="Riigikogu vaated" className="flex overflow-x-auto">
          {views.map((item) => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => setView(item.id)} className={`min-h-10 border-r border-[#d5dfe6] px-5 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#263d50] ${view === item.id ? "bg-[#102538] text-signal" : "hover:bg-[#f1f5f7] dark:hover:bg-[#102538]"}`}>{item.label}</button>)}
        </div>
      </section>

      {feed.loading && <div className="grid gap-3 sm:grid-cols-2"><div className="h-40 animate-pulse border border-[#b7c5cf] bg-white dark:border-[#263d50] dark:bg-[#0b1926]" /><div className="h-40 animate-pulse border border-[#b7c5cf] bg-white dark:border-[#263d50] dark:bg-[#0b1926]" /></div>}
      {feed.error && !feed.data && <section role="alert" className="border border-[#e49a92] bg-[#fff5f3] p-5 dark:border-[#733c3c] dark:bg-[#2a1719]"><h2 className="font-bold">Riigikogu andmed pole praegu kättesaadavad</h2><p className="mt-2 text-sm">{feed.error}</p><button type="button" onClick={feed.refresh} className="mt-4 border border-current px-3 py-2 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-signal">Proovi uuesti</button></section>}
      {feed.error && feed.data && <p role="alert" className="mb-4 border border-[#d7a65c] bg-[#fff7e7] px-4 py-3 text-xs text-[#714b12] dark:border-[#70572f] dark:bg-[#251f15] dark:text-[#ffd18f]">Värskendamine ebaõnnestus; kuvame viimati edukalt laaditud Riigikogu andmeid. {feed.error}</p>}
      {feed.data?.state !== "ok" && feed.data && <p role="status" className="mb-4 border border-[#d7a65c] bg-[#fff7e7] px-4 py-3 text-xs text-[#714b12] dark:border-[#70572f] dark:bg-[#251f15] dark:text-[#ffd18f]">Osaline ametlik vaade: {feed.data.unavailable.join(", ")} ei ole praegu värske. Ülejäänud andmed jäävad nähtavaks.</p>}

      {feed.data && <section aria-live="polite">
        {view === "today" && <AgendaView agenda={feed.data.agenda} now={now ?? new Date(feed.data.generatedAt)} />}
        {view === "votes" && <VotesView votes={feed.data.votes} selectedId={voteId} detail={vote.data} detailLoading={vote.loading} detailError={vote.error} onSelect={setVoteId} />}
        {view === "bills" && <BillsView bills={feed.data.bills} selectedId={billId} detail={bill.data} detailLoading={bill.loading} detailError={bill.error} onSelect={setBillId} />}
      </section>}

      {feed.data && <aside className="mt-5 border-t border-[#b7c5cf] pt-3 text-[10px] leading-5 text-[#657b8c] dark:border-[#263d50] dark:text-[#91a7b7]">
        <a href={feed.data.attribution.sourceUrl} target="_blank" rel="noreferrer" className="font-bold underline">Riigikogu Kantselei avaandmed ↗</a> · <a href={feed.data.attribution.licenceUrl} target="_blank" rel="noreferrer" className="underline">CC BY-SA 3.0 ↗</a>. Hääletuste fraktsioonid pärinevad hääletuse detailist; 117.ee kirjeldav fraktsioonierinevus ei ole Riigikogu ametlik hinnang.
      </aside>}
    </main>
  </RiigikoguPageFrame>;
}
