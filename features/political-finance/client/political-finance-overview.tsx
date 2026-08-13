import type { PoliticalFinancePartySummary, PoliticalFinanceResponse } from "../../../lib/political-finance-types";
import { money, percentage, periodLabel } from "./political-finance-formatters";

type Props = {
  data: PoliticalFinanceResponse;
  selectedPartyId: string;
  onSelectParty: (id: string) => void;
};

export function PoliticalFinanceOverview({ data, selectedPartyId, onSelectParty }: Props) {
  const totals = {
    income: completeTotal(data.parties.map((party) => party.income)),
    expenses: completeTotal(data.parties.map((party) => party.expenses)),
    donations: completeTotal(data.parties.map((party) => party.donations)),
  };

  return (
    <section aria-labelledby="finance-overview-title">
      <div className="grid border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926] sm:grid-cols-4">
        <Metric label="Aruandeperiood" value={periodLabel(data.period)} />
        <Metric label="Tulud kokku" value={money(totals.income)} />
        <Metric label="Kulud kokku" value={money(totals.expenses)} />
        <Metric label="Annetused kokku" value={money(totals.donations)} />
      </div>

      <div className="mt-3 border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
        <div className="flex items-center justify-between border-b border-[#b7c5ce] px-3 py-2 dark:border-[#29455a]">
          <h2 id="finance-overview-title" className="text-sm font-bold text-[#193b56] dark:text-[#d7e3eb]">Erakondade seis</h2>
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#617786] dark:text-[#7890a2]">Vali erakond detailideks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-xs">
            <thead className="bg-[#e5edf2] text-[10px] uppercase tracking-[0.06em] text-[#526878] dark:bg-[#102538] dark:text-[#8da1b0]">
              <tr><th className="px-3 py-2">Erakond</th><th className="px-3 py-2 text-right">Tulud</th><th className="px-3 py-2 text-right">Kulud</th><th className="px-3 py-2 text-right">Annetused</th><th className="px-3 py-2 text-right">Annetuste osa</th><th className="px-3 py-2 text-right">5 suurimat annetajat</th></tr>
            </thead>
            <tbody>
              {data.parties.map((party) => (
                <PartyRow key={party.id} party={party} selected={party.id === selectedPartyId} onSelect={() => onSelectParty(party.id)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function completeTotal(values: readonly (number | null)[]): number | null {
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[#b7c5ce] px-3 py-3 last:border-b-0 dark:border-[#29455a] sm:border-b-0 sm:border-r sm:last:border-r-0"><div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#617786] dark:text-[#7890a2]">{label}</div><div className="mt-1 text-lg font-bold tabular-nums text-[#193b56] dark:text-[#e8f0f6]">{value}</div></div>;
}

function PartyRow({ party, selected, onSelect }: { party: PoliticalFinancePartySummary; selected: boolean; onSelect: () => void }) {
  return (
    <tr className={`border-t border-[#c5d0d7] tabular-nums dark:border-[#203d52] ${selected ? "bg-[#dce9f5] dark:bg-[#102b40]" : "hover:bg-[#eaf0f4] dark:hover:bg-[#0d2030]"}`}>
      <th className="p-0 font-semibold">
        <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-h-11 w-full items-center gap-2 px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: party.color }} aria-hidden="true" />
          <span>{party.shortName}</span>
        </button>
      </th>
      <td className="px-3 py-2 text-right">{money(party.income)}</td>
      <td className="px-3 py-2 text-right">{money(party.expenses)}</td>
      <td className="px-3 py-2 text-right">{money(party.donations)}</td>
      <td className="px-3 py-2 text-right">{percentage(party.donationSharePct)}</td>
      <td className="px-3 py-2 text-right">{percentage(party.donorConcentrationTop5Pct)}</td>
    </tr>
  );
}
