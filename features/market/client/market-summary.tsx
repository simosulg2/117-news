import type { MarketRowView } from "../model/market-view-model";
import type { MarketSnapshot, MarketWindowState } from "../../../lib/market-types";

import {
  formatEur,
  formatPercent,
  formatTallinnTime,
  windowCopy,
} from "./market-formatters";

type MarketSummaryProps = {
  snapshot: MarketSnapshot;
  rows: readonly MarketRowView[];
  window: MarketWindowState;
};

function strongest(
  rows: readonly MarketRowView[],
  direction: "buy" | "sell",
): MarketRowView | null {
  return rows.filter((row) => row.reliable && row.signal?.direction === direction)
    .sort((left, right) => Math.abs(right.opportunity.gapPercent ?? 0)
      - Math.abs(left.opportunity.gapPercent ?? 0))[0] ?? null;
}

export function MarketSummary({ snapshot, rows, window }: MarketSummaryProps) {
  const copy = windowCopy(window);
  const buy = strongest(rows, "buy");
  const sell = strongest(rows, "sell");
  const signals = rows.filter((row) => row.highlighted).length;
  return (
    <>
      <section className={`border px-4 py-3 ${copy.healthy
        ? "border-[#16856d] bg-[#dff5ee] text-[#174f43] dark:bg-[#102d28] dark:text-[#9aead5]"
        : "border-[#9d762f] bg-[#f7ead2] text-[#67460f] dark:bg-[#2b2417] dark:text-[#efc983]"}`}>
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center sm:gap-5">
          <p className="font-black">{copy.title}</p>
          <p className="text-[11px] font-semibold leading-5">{copy.detail}</p>
        </div>
      </section>

      <section className="grid gap-px border-x border-b border-[#aebcc6] bg-[#aebcc6] dark:border-[#29485f] dark:bg-[#29485f] sm:grid-cols-2 lg:grid-cols-4">
        <article className="bg-white p-3 dark:bg-[#0b1b29]">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">Tugevad signaalid</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-[#172634] dark:text-[#edf4f8]">{signals}</p>
          <p className="mt-1 text-[10px] text-[#6b7f8d] dark:text-[#7890a2]">{snapshot.availableCount}/{snapshot.instrumentCount} võrreldud</p>
        </article>
        <article className="bg-white p-3 dark:bg-[#0b1b29]">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">Suurim ostusuund</p>
          <p className="mt-1 truncate text-sm font-black text-[#11634f] dark:text-[#66ddbd]">{buy?.opportunity.name ?? "—"}</p>
          <p className="mt-1 text-xs font-bold tabular-nums text-[#40596b] dark:text-[#b8c8d3]">{formatPercent(buy?.opportunity.gapPercent ?? null)}</p>
        </article>
        <article className="bg-white p-3 dark:bg-[#0b1b29]">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">Suurim müügisuund</p>
          <p className="mt-1 truncate text-sm font-black text-[#65398f] dark:text-[#c7a1ec]">{sell?.opportunity.name ?? "—"}</p>
          <p className="mt-1 text-xs font-bold tabular-nums text-[#40596b] dark:text-[#b8c8d3]">{formatPercent(sell?.opportunity.gapPercent ?? null)}</p>
        </article>
        <article className="bg-white p-3 dark:bg-[#0b1b29]">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">EUR/USD</p>
          <p className="mt-1 text-sm font-black tabular-nums text-[#172634] dark:text-[#edf4f8]">{snapshot.eurUsd?.value.toFixed(5) ?? "—"}</p>
          <p className="mt-1 text-[10px] text-[#6b7f8d] dark:text-[#7890a2]">uuendatud {formatTallinnTime(snapshot.fetchedAt)}</p>
        </article>
      </section>

      {snapshot.availableCount < snapshot.instrumentCount && (
        <p role="status" className="border-x border-b border-[#9d762f] bg-[#f7ead2] px-3 py-2 text-[11px] font-semibold text-[#67460f] dark:bg-[#2b2417] dark:text-[#efc983]">
          Osa hinnapaare jäi allikast tulemata. Puuduvad read ei muutu signaaliks; proovi värskendamist.
        </p>
      )}
    </>
  );
}
