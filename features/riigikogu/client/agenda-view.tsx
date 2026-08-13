import type { RiigikoguAgenda } from "@/lib/riigikogu-types";
import { selectAgendaSittings } from "@/features/riigikogu/model/agenda-selection";
import { safeDate } from "./riigikogu-formatters";

export function AgendaView({ agenda, now }: { agenda: RiigikoguAgenda | null; now: Date }) {
  const selection = selectAgendaSittings(agenda, now);
  if (selection.mode === "empty") return <section className="border border-[#b7c5cf] bg-white p-5 dark:border-[#263d50] dark:bg-[#0b1926]">
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#657b8c]">Täna</p>
    <h2 className="mt-2 text-xl font-bold">Täiskogu istungit täna päevakorras ei ole</h2>
    <p className="mt-2 max-w-2xl text-sm text-[#5a6f7f] dark:text-[#9bb0bf]">
      Selles ametlikus nädalavaates ei ole ka järgmist istungit avaldatud.
    </p>
  </section>;
  return <div className="space-y-4">
    {selection.mode === "next" && <div role="status" className="border border-[#d7a65c] bg-[#fff7e7] px-4 py-3 text-xs text-[#714b12] dark:border-[#70572f] dark:bg-[#251f15] dark:text-[#ffd18f]">
      <b>Täna täiskogu istungit ei ole.</b> Kuvame järgmist avaldatud istungit: {safeDate(selection.sittings[0].startsAt, true)}.
    </div>}
    {selection.sittings.map((sitting) => <section key={sitting.id} className="border border-[#b7c5cf] bg-white dark:border-[#263d50] dark:bg-[#0b1926]">
      <header className="border-b border-[#d5dfe6] px-4 py-3 dark:border-[#263d50]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-signal">{selection.mode === "today" ? "Täna" : "Järgmine istung"} · {safeDate(sitting.startsAt, true)}</p>
        <h2 className="mt-1 font-bold">{sitting.title}</h2>
      </header>
      {sitting.items.length ? <ol className="divide-y divide-[#e1e8ed] dark:divide-[#1d3344]">
        {sitting.items.map((item) => <li key={item.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[2.5rem_1fr_auto]">
          <span className="font-mono text-xs text-[#718696]">{String(item.order).padStart(2, "0")}</span>
          <div><p className="text-sm font-semibold leading-5">{item.title}</p><p className="mt-1 text-xs text-[#657b8c]">{item.type ?? "Päevakorrapunkt"}{item.stage ? ` · ${item.stage.replaceAll("_", " ").toLocaleLowerCase("et")}` : ""}</p></div>
          {item.draft && <a className="text-xs font-bold text-[#246ed8] underline-offset-2 hover:underline dark:text-[#7db0ff]" href={item.draft.sourceUrl} target="_blank" rel="noreferrer">Ametlik kirje ↗</a>}
        </li>)}
      </ol> : <p className="px-4 py-5 text-sm text-[#657b8c]">Päevakorrapunkte ei ole avaldatud.</p>}
    </section>)}
  </div>;
}
