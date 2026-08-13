import type { PoliticalFinanceResponse } from "../../../lib/political-finance-types";
import { periodLabel, retrievedLabel } from "./political-finance-formatters";

type Props = {
  data: PoliticalFinanceResponse | null;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
};

export function PoliticalFinanceStatus({ data, error, refreshing, onRefresh }: Props) {
  return (
    <>
      <div className="mb-3 grid gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 text-xs font-semibold text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2] sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h1 className="font-bold text-[#245fae] dark:text-signal">Erakondade raha</h1>
          <span>ERJK kvartaliaruanded · tulud, kulud ja annetused</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
          <span aria-live="polite">
            {refreshing ? "Värskendan…" : data ? `${periodLabel(data.period)} · tõmmis ${retrievedLabel(data.retrievedAt)}` : "Andmeid laaditakse"}
          </span>
          <button type="button" onClick={onRefresh} disabled={refreshing} className="font-semibold underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal disabled:cursor-wait disabled:no-underline disabled:opacity-60 dark:hover:text-[#7db0ff]">
            Uuenda
          </button>
        </div>
      </div>

      {data?.source.status !== "ok" && data && (
        <div role="status" className="mb-3 border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs leading-5 text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
          <b>{data.source.status === "stale" ? "Kasutusel on viimane edukas tõmmis." : "Osa detailandmeid puudub."}</b>{" "}{data.source.statusMessage}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-3 flex flex-col gap-3 border border-[#9d2f2f] bg-[#b42318]/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#b42318] dark:text-[#ff6b63]">Rahastamisandmete laadimine ebaõnnestus</p>
            <p className="mt-1 text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">{error}</p>
          </div>
          <button type="button" onClick={onRefresh} className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-xs font-semibold text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]">
            Proovi uuesti
          </button>
        </div>
      )}
    </>
  );
}

export function PoliticalFinanceLoading() {
  return (
    <div aria-label="Laadin rahastamisandmeid" className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="h-96 border border-[#9fb2c0] bg-[#f4f7f9] p-4 dark:border-[#35536a] dark:bg-[#0a1926]"><div className="skeleton h-5 w-48" /><div className="skeleton mt-8 h-64 w-full" /></div>
      <div className="h-96 border border-[#9fb2c0] bg-[#f4f7f9] p-4 dark:border-[#35536a] dark:bg-[#0a1926]"><div className="skeleton h-5 w-36" /><div className="skeleton mt-8 h-64 w-full" /></div>
    </div>
  );
}
