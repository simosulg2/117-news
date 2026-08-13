import type { RiigikoguVoteChoice, RiigikoguVoteDetail as VoteDetail } from "@/lib/riigikogu-types";
import { choiceLabels } from "./riigikogu-formatters";

const choices: RiigikoguVoteChoice[] = ["in-favor", "against", "neutral", "did-not-vote", "absent", "unknown"];

export function VoteDetailPanel({ data, loading, error }: { data: VoteDetail | null; loading: boolean; error: string | null }) {
  if (loading) return <p className="border-t border-[#d5dfe6] p-4 text-sm dark:border-[#263d50]">Hääletuse detail laadib…</p>;
  if (error) return <p role="alert" className="border-t border-[#d5dfe6] p-4 text-sm text-[#b42318] dark:border-[#263d50] dark:text-[#ff9b92]">{error}</p>;
  if (!data) return null;
  return <div className="border-t border-[#9fb2c0] bg-[#f5f8fa] p-4 dark:border-[#35536a] dark:bg-[#081522]">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-bold uppercase tracking-[0.1em]">Fraktsioonide ja liikmete valikud</p>
      <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${data.reconciles ? "text-[#087a5b] dark:text-[#55d6b2]" : "text-[#a34b00] dark:text-[#ffbd78]"}`}>
        {data.reconciles ? "Summad klapivad" : "Ametlikud summad vajavad kontrolli"}
      </span>
    </div>
    <p className="mt-2 text-xs text-[#657b8c] dark:text-[#91a7b7]">Fraktsioon on hääletuse kirjes talletatud tolle hetke fraktsioon. Kõrvalekalle tähendab ainult erinevust fraktsiooni antud häälte ainukesest paljususest; viigi korral seda ei arvutata.</p>
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[45rem] border-collapse text-left text-xs">
        <thead><tr className="border-y border-[#c9d5dd] text-[#657b8c] dark:border-[#30495c]">
          <th className="px-2 py-2">Fraktsioon</th>{choices.slice(0, 5).map((choice) => <th key={choice} className="px-2 py-2 text-right">{choiceLabels[choice]}</th>)}<th className="px-2 py-2">Kirjeldav erinevus</th>
        </tr></thead>
        <tbody>{data.factions.map((faction) => <tr key={faction.factionId} className="border-b border-[#dbe3e8] dark:border-[#203748]">
          <td className="px-2 py-2 font-semibold">{faction.factionName}</td>
          {choices.slice(0, 5).map((choice) => <td key={choice} className="px-2 py-2 text-right tabular-nums">{faction.totals[choice]}</td>)}
          <td className="px-2 py-2 text-[#657b8c]">{faction.deviations.join(", ") || "—"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <details className="mt-4 border border-[#c9d5dd] bg-white dark:border-[#30495c] dark:bg-[#0b1926]">
      <summary className="cursor-pointer px-3 py-2 text-xs font-bold outline-none focus-visible:ring-1 focus-visible:ring-signal">Kõik 101 liikme valikud</summary>
      <ul className="grid border-t border-[#d5dfe6] sm:grid-cols-2 lg:grid-cols-3 dark:border-[#263d50]">
        {data.voters.map((voter) => <li key={voter.memberId} className="flex justify-between gap-2 border-b border-[#edf1f4] px-3 py-2 text-xs dark:border-[#172b3b]">
          <span>{voter.fullName}</span><span className="font-semibold">{choiceLabels[voter.choice]}</span>
        </li>)}
      </ul>
    </details>
    <p className="mt-3 text-[10px] text-[#718696]">Ametlik detail: <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="underline">api.riigikogu.ee ↗</a></p>
  </div>;
}
