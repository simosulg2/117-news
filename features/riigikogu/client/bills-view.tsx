import type { RiigikoguBillDetail, RiigikoguBillSummary } from "@/lib/riigikogu-types";
import { WatchToggle } from "@/features/watchlist/client/watch-toggle";
import { codeLabel, safeDate } from "./riigikogu-formatters";
import { BillDetailPanel } from "./bill-detail";

type Props = { bills: RiigikoguBillSummary[]; selectedId: string | null; detail: RiigikoguBillDetail | null; detailLoading: boolean; detailError: string | null; onSelect: (id: string | null) => void };

export function BillsView({ bills, selectedId, detail, detailLoading, detailError, onSelect }: Props) {
  if (!bills.length) return <p className="border border-[#b7c5cf] bg-white p-5 text-sm dark:border-[#263d50] dark:bg-[#0b1926]">Menetluses eelnõusid ei õnnestunud laadida.</p>;
  return <div className="space-y-3">{bills.map((bill) => {
    const open = bill.id === selectedId;
    return <article key={bill.id} className="border border-[#b7c5cf] bg-white dark:border-[#263d50] dark:bg-[#0b1926]">
      <div className="grid gap-3 p-4 sm:grid-cols-[6rem_1fr_auto]">
        <div><p className="font-mono text-sm font-bold">{bill.mark ? `${bill.mark} ${bill.typeCode ?? ""}` : bill.typeCode ?? "—"}</p><p className="mt-1 text-[10px] text-[#657b8c]">{safeDate(bill.statusDate)}</p></div>
        <button type="button" aria-expanded={open} onClick={() => onSelect(open ? null : bill.id)} className="text-left outline-none focus-visible:ring-2 focus-visible:ring-signal">
          <h2 className="text-sm font-bold leading-5">{bill.title}</h2><p className="mt-1 text-xs text-[#657b8c]">{bill.leadingCommittee ?? "Juhtivkomisjon puudub"}</p>
        </button>
        <div className="flex items-center gap-3 text-xs"><span className="font-semibold">{codeLabel(bill.stageCode)}</span><WatchToggle kind="riigikogu-bill" targetId={bill.id} label={bill.title} compact /><button type="button" aria-label={open ? "Sulge eelnõu detail" : "Ava eelnõu detail"} aria-expanded={open} onClick={() => onSelect(open ? null : bill.id)} className="min-h-7 min-w-7 border border-[#91a5b3] font-bold outline-none focus-visible:ring-2 focus-visible:ring-signal">{open ? "−" : "+"}</button></div>
      </div>
      {open && <BillDetailPanel data={detail} loading={detailLoading} error={detailError} />}
    </article>;
  })}</div>;
}
