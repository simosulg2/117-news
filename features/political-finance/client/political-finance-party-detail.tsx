import type { PoliticalFinancePartySummary } from "../../../lib/political-finance-types";
import { dateLabel, money, percentage } from "./political-finance-formatters";

export function PoliticalFinancePartyDetail({ party }: { party: PoliticalFinancePartySummary }) {
  const historyMaximum = Math.max(1, ...party.history.flatMap((point) => [point.income, point.expenses]).filter((value): value is number => value !== null));
  return (
    <section aria-labelledby="party-finance-title" className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
      <div className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
        <div className="flex items-center justify-between gap-3 border-b border-[#b7c5ce] px-3 py-2 dark:border-[#29455a]">
          <div><h2 id="party-finance-title" className="text-sm font-bold text-[#193b56] dark:text-[#d7e3eb]">{party.name}</h2><p className="mt-0.5 text-[10px] text-[#617786] dark:text-[#7890a2]">ERJK nimetus: {party.sourceName}</p></div>
          <a href={party.filing.sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] font-semibold text-[#245fae] underline underline-offset-2 outline-none hover:text-[#173f76] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#7db0ff]">Ametlik aruanne ↗</a>
        </div>
        <div className="grid gap-4 p-3 md:grid-cols-2">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#617786] dark:text-[#7890a2]">Tulude koosseis</h3>
            <div className="mt-2 space-y-2">
              {party.income === null && <p className="text-xs text-[#805818] dark:text-[#efb860]">Tulude koondandmed pole saadaval.</p>}
              {party.incomeCategories.map((category) => (
                <div key={category.id}>
                  <div className="flex justify-between gap-3 text-xs"><span>{category.name}</span><span className="tabular-nums">{money(category.amount)} · {percentage(category.sharePct)}</span></div>
                  <div className="mt-1 h-1.5 bg-[#d7e0e6] dark:bg-[#183044]"><div className="h-full bg-signal" style={{ width: `${Math.min(100, Math.max(0, category.sharePct))}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#617786] dark:text-[#7890a2]">Kuni 8 viimast kvartalit</h3>
            <div className="mt-2 space-y-2">
              {party.history.map((point) => (
                <div key={point.period} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-[10px]">
                  <span className="font-semibold tabular-nums">{point.period}</span>
                  <div className="space-y-0.5">
                    <HistoryBar label="Tulud" value={point.income} maximum={historyMaximum} color="bg-[#368469]" />
                    <HistoryBar label="Kulud" value={point.expenses} maximum={historyMaximum} color="bg-[#c2634c]" />
                    {(point.income === null || point.expenses === null) && (
                      <span className="block text-[9px] leading-3 text-[#805818] dark:text-[#efb860]">
                        Andmed puuduvad: {[point.income === null ? "tulud" : null, point.expenses === null ? "kulud" : null].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-[10px] text-[#617786] dark:text-[#7890a2]"><span><i className="mr-1 inline-block size-2 bg-[#368469]" />Tulud</span><span><i className="mr-1 inline-block size-2 bg-[#c2634c]" />Kulud</span></div>
          </div>
        </div>
        {party.detailReconciles === false && (
          <p role="status" className="border-t border-[#9d762f] px-3 py-2 text-[11px] text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
            ERJK koondsumma ja detailread erinevad rohkem kui ümardus lubab. Koondsummad pärinevad koondpäringust; annetajate vaade detailaruandest.
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RankedList title="Suurimad annetajad" empty="Annetajate detail pole saadaval.">
          {party.largestDonors.map((donor) => <li key={donor.id} className="flex justify-between gap-3 border-t border-[#c5d0d7] px-3 py-2 text-xs first:border-t-0 dark:border-[#203d52]"><span className="min-w-0 truncate">{donor.donorName}<small className="ml-1 text-[#617786] dark:text-[#7890a2]">({donor.donationCount})</small>{donor.ambiguousIdentity && <small className="ml-1 text-[#805818] dark:text-[#efb860]">sama nimega kirjed</small>}</span><b className="shrink-0 tabular-nums">{money(donor.amount)}</b></li>)}
        </RankedList>
        <RankedList title="Suurimad annetused" empty="Annetuste detail pole saadaval.">
          {party.largestDonations.map((donation) => <li key={donation.id} className="border-t border-[#c5d0d7] px-3 py-2 text-xs first:border-t-0 dark:border-[#203d52]"><div className="flex justify-between gap-3"><span className="min-w-0 truncate">{donation.donorName}</span><b className="shrink-0 tabular-nums">{money(donation.amount, true)}</b></div><div className="mt-0.5 text-[10px] text-[#617786] dark:text-[#7890a2]">{dateLabel(donation.date)} · {donation.category}</div></li>)}
        </RankedList>
      </div>
    </section>
  );
}

function HistoryBar({ label, value, maximum, color }: { label: string; value: number | null; maximum: number; color: string }) {
  const exact = `${label}: ${value === null ? "andmed puuduvad" : money(value)}`;
  return <><span className="sr-only">{exact}</span><div aria-hidden="true" className={`h-1.5 ${value === null ? "border border-dashed border-[#9d762f] dark:border-[#8f6728]" : "bg-[#d7e0e6] dark:bg-[#183044]"}`} title={exact}>{value !== null && <div className={`h-full ${color}`} style={{ width: `${value / maximum * 100}%` }} />}</div></>;
}

function RankedList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]"><h3 className="border-b border-[#b7c5ce] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#617786] dark:border-[#29455a] dark:text-[#7890a2]">{title}</h3>{hasChildren ? <ol>{children}</ol> : <p className="px-3 py-5 text-xs text-[#617786] dark:text-[#7890a2]">{empty}</p>}</div>;
}
