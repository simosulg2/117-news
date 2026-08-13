"use client";

import { useEffect, useState } from "react";

import type {
  PoliticalFinancePartySummary,
  PoliticalFinancePeriod,
  PoliticalFinanceRecordsResponse,
  PoliticalFinanceRecordType,
  PoliticalFinanceUnavailableResponse,
} from "../../../lib/political-finance-types";
import { dateLabel, money, periodLabel } from "./political-finance-formatters";

type Props = {
  party: PoliticalFinancePartySummary;
  availablePeriods: PoliticalFinancePeriod[];
};

export function PoliticalFinanceRecords({ party, availablePeriods }: Props) {
  const [period, setPeriod] = useState<PoliticalFinancePeriod>(party.filing.period);
  const [recordType, setRecordType] = useState<PoliticalFinanceRecordType>("donations");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PoliticalFinanceRecordsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPeriod(party.filing.period);
    setCategory("");
    setPage(1);
  }, [party.id, party.filing.period]);

  useEffect(() => {
    if (!party.canonicalPartyId) {
      setData(null);
      setError("Selle ERJK aruandja jaoks puudub veel kindel seos ühise erakonnaregistriga.");
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      party: party.canonicalPartyId,
      period,
      type: recordType,
      page: String(page),
      pageSize: "20",
    });
    if (category) params.set("category", category);
    setLoading(true);
    setData(null);
    setError(null);
    fetch(`/api/political-finance/records?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as PoliticalFinanceRecordsResponse | PoliticalFinanceUnavailableResponse;
        if (!response.ok || "error" in body) throw new Error("error" in body ? body.error : "Kirjete laadimine ebaõnnestus.");
        setData(body);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Kirjete laadimine ebaõnnestus.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [category, page, party.canonicalPartyId, period, recordType]);

  function changeType(next: PoliticalFinanceRecordType) {
    setRecordType(next);
    setCategory("");
    setPage(1);
  }

  return (
    <section aria-labelledby="finance-records-title" className="mt-3 border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="flex flex-col gap-3 border-b border-[#b7c5ce] px-3 py-3 dark:border-[#29455a] lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="finance-records-title" className="text-sm font-bold text-[#193b56] dark:text-[#d7e3eb]">Aruande kirjed</h2>
          <p className="mt-1 max-w-3xl text-[11px] leading-4 text-[#617786] dark:text-[#7890a2]">Kirjed tulevad valitud ERJK kvartaliaruandest. Sünniaegu ega muid identifikaatoreid 117.ee ei säilita ega kuva.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select label="Periood" value={period} onChange={(value) => { setPeriod(value as PoliticalFinancePeriod); setCategory(""); setPage(1); }}>
            {availablePeriods.map((item) => <option key={item} value={item}>{periodLabel(item)}</option>)}
          </Select>
          <Select label="Kirje liik" value={recordType} onChange={(value) => changeType(value as PoliticalFinanceRecordType)}>
            <option value="donations">Annetused</option><option value="income">Kõik tulud</option><option value="expenses">Kululiigid</option>
          </Select>
          <Select label="Kategooria" value={category} onChange={(value) => { setCategory(value); setPage(1); }}>
            <option value="">Kõik kategooriad</option>
            {data?.availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.count})</option>)}
          </Select>
        </div>
      </div>

      {error && <div role="alert" className="m-3 border border-[#9d762f] px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">{error}</div>}
      {loading && !data && <div className="p-3"><div className="skeleton h-40 w-full" /></div>}
      {data && (
        <>
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className="w-full min-w-[42rem] text-left text-xs">
              <thead className="bg-[#e5edf2] text-[10px] uppercase tracking-[0.06em] text-[#526878] dark:bg-[#102538] dark:text-[#8da1b0]"><tr><th className="px-3 py-2">Kuupäev</th><th className="px-3 py-2">Nimi / kirje</th><th className="px-3 py-2">Kategooria</th><th className="px-3 py-2 text-right">Summa</th><th className="px-3 py-2 text-right">Allikas</th></tr></thead>
              <tbody>
                {data.records.map((record) => <tr key={record.id} className="border-t border-[#c5d0d7] dark:border-[#203d52]"><td className="whitespace-nowrap px-3 py-2 tabular-nums">{dateLabel(record.date)}</td><td className="px-3 py-2 font-semibold">{record.reportedName ?? record.categoryName}</td><td className="px-3 py-2 text-[#526878] dark:text-[#8da1b0]">{record.categoryName}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{money(record.amount, true)}</td><td className="px-3 py-2 text-right"><a href={record.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#245fae] underline underline-offset-2 outline-none focus-visible:ring-1 focus-visible:ring-signal dark:text-[#7db0ff]">ERJK ↗</a></td></tr>)}
                {data.records.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-[#617786] dark:text-[#7890a2]">Selle filtriga kirjeid ei leitud.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#b7c5ce] px-3 py-2 text-xs dark:border-[#29455a]">
            <span className="tabular-nums">{data.total} kirjet · lk {data.page}/{data.totalPages}{loading ? " · värskendan…" : ""}</span>
            <div className="flex gap-2"><PageButton disabled={data.page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Eelmine</PageButton><PageButton disabled={data.page >= data.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Järgmine</PageButton></div>
          </div>
        </>
      )}
    </section>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#617786] dark:text-[#7890a2]"><span className="block pb-1">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-9 max-w-[14rem] border border-[#879aa8] bg-white px-2 text-xs normal-case tracking-normal text-[#172b3b] outline-none focus:border-signal focus:ring-1 focus:ring-signal dark:border-[#3b5870] dark:bg-[#0d2030] dark:text-[#e8f0f6]">{children}</select></label>;
}

function PageButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="min-h-9 border border-[#879aa8] px-3 font-semibold outline-none hover:border-signal hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#3b5870] dark:hover:text-[#7db0ff]">{children}</button>;
}
