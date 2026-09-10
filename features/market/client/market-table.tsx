import {
  filterAndSortMarketRows,
  type MarketDirectionFilter,
  type MarketRowView,
  type MarketSortOrder,
} from "../model/market-view-model";

import {
  formatAge,
  formatEur,
  formatPercent,
  formatTallinnTime,
  formatUsd,
} from "./market-formatters";

type MarketTableProps = {
  rows: readonly MarketRowView[];
  showAll: boolean;
  tradeAmount: number;
  query: string;
  directionFilter: MarketDirectionFilter;
  sortOrder: MarketSortOrder;
};

function directionStyle(direction: "buy" | "sell", strong: boolean): string {
  if (!strong) return "border-[#9fb2c0] text-[#526878] dark:border-[#35536a] dark:text-[#8da1b0]";
  return direction === "buy"
    ? "border-[#16856d] bg-[#dff5ee] text-[#11634f] dark:bg-[#102d28] dark:text-[#66ddbd]"
    : "border-[#8756bb] bg-[#eee5f7] text-[#65398f] dark:bg-[#281d36] dark:text-[#c7a1ec]";
}

export function MarketTable({
  rows,
  showAll,
  tradeAmount,
  query,
  directionFilter,
  sortOrder,
}: MarketTableProps) {
  const visible = filterAndSortMarketRows(rows, {
    showAll,
    query,
    directionFilter,
    sortOrder,
  });
  const hasListFilter = Boolean(query.trim()) || directionFilter !== "all";
  if (visible.length === 0) {
    return (
      <div className="border border-[#aebcc6] bg-white px-5 py-10 text-center dark:border-[#29485f] dark:bg-[#0b1b29]">
        <p className="text-base font-black text-[#172634] dark:text-[#edf4f8]">
          {hasListFilter ? "Ükski instrument ei vasta filtrile" : "Praegu tugevat signaali ei ole"}
        </p>
        <p className="mt-2 text-xs leading-5 text-[#617786] dark:text-[#8da1b0]">
          {hasListFilter
            ? "Muuda otsingut või lähtesta filtrid, et instrumente uuesti näha."
            : "Vähenda piirmäära või lülita sisse „Näita kõiki instrumente”, et näha tervet võrdlust."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-[#aebcc6] bg-white dark:border-[#29485f] dark:bg-[#0b1b29]">
      <table className="w-full min-w-[66rem] border-collapse text-left text-xs">
        <thead className="bg-[#e3ebf0] text-[9px] font-black uppercase tracking-[0.1em] text-[#526878] dark:bg-[#102538] dark:text-[#8da1b0]">
          <tr>
            <th scope="col" className="px-3 py-2.5">Instrument</th>
            <th scope="col" className="px-3 py-2.5">Suund</th>
            <th scope="col" className="px-3 py-2.5 text-right">Võistluse hind</th>
            <th scope="col" className="px-3 py-2.5 text-right">USA hind</th>
            <th scope="col" className="px-3 py-2.5 text-right">USA → EUR</th>
            <th scope="col" className="px-3 py-2.5 text-right">Erinevus</th>
            <th scope="col" className="px-3 py-2.5 text-right">Neto*</th>
            <th scope="col" className="px-3 py-2.5">Kontroll</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const { opportunity, signal } = row;
            const direction = signal?.direction ?? "buy";
            const referenceMinute = opportunity.referenceTradeMinutesBeforeClose;
            return (
              <tr
                key={opportunity.id}
                className={`border-t border-[#d2dce2] align-top dark:border-[#20394d] ${
                  row.highlighted ? "bg-[#f5faf8] dark:bg-[#0d211f]" : ""
                } ${row.reliable ? "" : "opacity-60"}`}
              >
                <th scope="row" className="px-3 py-3 font-normal">
                  <a
                    href={opportunity.investingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-black text-[#174f90] underline decoration-[#9bb8d6] underline-offset-2 hover:text-[#0f3766] dark:text-[#7db0ff] dark:decoration-[#355d83]"
                  >
                    {opportunity.name} ↗
                  </a>
                  <span className="mt-1 block text-[10px] font-semibold text-[#6b7f8d] dark:text-[#7890a2]">
                    {opportunity.xetraSymbol} · {opportunity.usSymbol}
                    {opportunity.usUnits > 1 ? ` · ADR 1:${opportunity.usUnits}` : ""}
                  </span>
                </th>
                <td className="px-3 py-3">
                  {signal ? (
                    <span className={`inline-flex min-w-12 justify-center border px-2 py-1 text-[9px] font-black tracking-[0.08em] ${directionStyle(direction, row.highlighted)}`}>
                      {direction === "buy" ? "OSTA" : "MÜÜ"}
                    </span>
                  ) : "—"}
                  {row.actionable && <span className="mt-1 block text-[9px] font-bold text-[#11634f] dark:text-[#66ddbd]">aken avatud</span>}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <b className="text-[#172634] dark:text-[#edf4f8]">{formatEur(opportunity.reference?.value ?? null)}</b>
                  <span className="mt-1 block text-[9px] text-[#6b7f8d] dark:text-[#7890a2]">
                    {formatTallinnTime(opportunity.reference?.at ?? null)}
                    {referenceMinute !== null ? ` · ${referenceMinute} min enne` : ""}
                  </span>
                  {opportunity.auction && (
                    <span className="mt-0.5 block text-[9px] text-[#6b7f8d] dark:text-[#7890a2]">
                      oksjon {formatEur(opportunity.auction.value)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <b className="text-[#172634] dark:text-[#edf4f8]">{formatUsd(opportunity.usPrice?.value ?? null)}</b>
                  <span className="mt-1 block text-[9px] text-[#6b7f8d] dark:text-[#7890a2]">
                    {formatTallinnTime(opportunity.usPrice?.at ?? null)} · {formatAge(opportunity.usQuoteAgeSeconds)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-[#40596b] dark:text-[#b8c8d3]">
                  {formatEur(opportunity.impliedEur)}
                </td>
                <td className={`px-3 py-3 text-right text-sm font-black tabular-nums ${
                  (opportunity.gapPercent ?? 0) >= 0
                    ? "text-[#11634f] dark:text-[#66ddbd]"
                    : "text-[#65398f] dark:text-[#c7a1ec]"
                }`}>
                  {formatPercent(opportunity.gapPercent)}
                </td>
                <td className={`px-3 py-3 text-right font-black tabular-nums ${
                  (signal?.netAfterRoundTripEur ?? -1) > 0
                    ? "text-[#11634f] dark:text-[#66ddbd]"
                    : "text-[#8b4b31] dark:text-[#e3a087]"
                }`}>
                  {formatEur(signal?.netAfterRoundTripEur ?? null)}
                  <span className="mt-1 block text-[9px] font-semibold text-[#6b7f8d] dark:text-[#7890a2]">{formatEur(tradeAmount)} pealt</span>
                </td>
                <td className="max-w-44 px-3 py-3 text-[10px] leading-4 text-[#526878] dark:text-[#8da1b0]">
                  {opportunity.issues.length === 0
                    ? <span className="font-bold text-[#11634f] dark:text-[#66ddbd]">Värske</span>
                    : opportunity.issues.join(" · ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
