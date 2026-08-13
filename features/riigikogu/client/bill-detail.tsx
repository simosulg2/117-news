import type { RiigikoguBillDetail as BillDetail } from "@/lib/riigikogu-types";
import { codeLabel, safeDate } from "./riigikogu-formatters";

export function BillDetailPanel({ data, loading, error }: { data: BillDetail | null; loading: boolean; error: string | null }) {
  if (loading) return <p className="border-t border-[#d5dfe6] p-4 text-sm dark:border-[#263d50]">Eelnõu detail laadib…</p>;
  if (error) return <p role="alert" className="border-t border-[#d5dfe6] p-4 text-sm text-[#b42318] dark:border-[#263d50] dark:text-[#ff9b92]">{error}</p>;
  if (!data) return null;
  return <div className="grid gap-5 border-t border-[#9fb2c0] bg-[#f5f8fa] p-4 md:grid-cols-2 dark:border-[#35536a] dark:bg-[#081522]">
    <section><h3 className="text-xs font-bold uppercase tracking-[0.1em]">Ametlikud andmed</h3><dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-xs">
      <dt className="text-[#657b8c]">Staatus</dt><dd>{codeLabel(data.statusCode)}</dd>
      <dt className="text-[#657b8c]">Algatatud</dt><dd>{safeDate(data.initiatedAt)}</dd>
      <dt className="text-[#657b8c]">Muudatuste tähtaeg</dt><dd>{safeDate(data.amendmentsDeadline, true)}</dd>
      <dt className="text-[#657b8c]">Vastu võetud</dt><dd>{safeDate(data.acceptedAt)}</dd>
      <dt className="text-[#657b8c]">Algatajad</dt><dd>{data.initiators.join(", ") || "—"}</dd>
    </dl>
    {data.documents.length > 0 && <div className="mt-4"><h4 className="text-xs font-bold">Dokumendid</h4><ul className="mt-2 space-y-1 text-xs">{data.documents.map((document, index) => <li key={`${document.sourceUrl}-${index}`}><a href={document.sourceUrl} target="_blank" rel="noreferrer" className="text-[#246ed8] underline dark:text-[#7db0ff]">{document.title} ↗</a></li>)}</ul></div>}
    </section>
    <section><h3 className="text-xs font-bold uppercase tracking-[0.1em]">Menetluskäik</h3>{data.events.length ? <ol className="mt-3 border-l border-[#9fb2c0] pl-4 dark:border-[#35536a]">{data.events.map((event, index) => <li key={`${event.happenedAt}-${index}`} className="pb-3 text-xs"><b>{codeLabel(event.readingCode)}</b><br /><span className="text-[#657b8c]">{safeDate(event.happenedAt, true)}</span></li>)}</ol> : <p className="mt-3 text-xs text-[#657b8c]">Menetlussündmusi ei ole avaldatud.</p>}
    <p className="mt-2 text-[10px] text-[#718696]">Ametlik kirje: <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="underline">api.riigikogu.ee ↗</a></p></section>
  </div>;
}
