import type { EconomyIndicator } from "@/lib/economy-types";
import { WatchToggle } from "@/features/watchlist/client/watch-toggle";

import { formatComparison, formatEconomyValue, formatSourceDate, previousLabel } from "./economy-formatters";
import { EconomySparkline } from "./economy-sparkline";

const outlookCopy = {
  improved: { label: "Paranenud", className: "border-[#168365] text-[#107052] dark:border-[#2bb890] dark:text-[#55d6b2]" },
  worsened: { label: "Halvenenud", className: "border-[#b43b35] text-[#a02d28] dark:border-[#d95750] dark:text-[#ff7d76]" },
  neutral: { label: "Neutraalne", className: "border-[#718796] text-[#526878] dark:border-[#526f85] dark:text-[#a9b7c2]" },
  unavailable: { label: "Pole saadaval", className: "border-[#9d762f] text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]" },
} as const;

type EconomyIndicatorCardProps = {
  indicator: EconomyIndicator;
};

export function EconomyIndicatorCard({ indicator }: EconomyIndicatorCardProps) {
  const outlook = outlookCopy[indicator.classification.outlook];
  return (
    <article className="terminal-row relative flex min-h-[25rem] flex-col border border-[#9fb2c0] bg-[#f8fafb] p-3 shadow-[0_1px_0_rgba(36,95,174,0.08)] dark:border-[#35536a] dark:bg-[#0a1926] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#172b3b] dark:text-[#e8f0f6]">{indicator.label}</h3>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890a2]">
            {indicator.geographyLabel} · {indicator.current?.period.label ?? "andmed puuduvad"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${outlook.className}`}>
            {outlook.label}
          </span>
          <WatchToggle kind="economy-indicator" targetId={indicator.id} label={indicator.label} compact />
        </div>
      </div>

      <div className="mt-5 min-h-14 tabular-nums">
        {indicator.current ? (
          <p className="font-display text-[2rem] font-bold leading-none text-[#245fae] dark:text-[#7db0ff] sm:text-[2.35rem]">
            {formatEconomyValue(indicator.current.value, indicator.unit)}
          </p>
        ) : (
          <p className="text-xl font-bold text-[#805818] dark:text-[#efb860]">Ei ole avaldatud</p>
        )}
      </div>

      <p className="mt-2 min-h-10 text-xs leading-5 text-[#526878] dark:text-[#9aabb7]">{indicator.description}</p>
      <div className="mt-3"><EconomySparkline indicator={indicator} /></div>

      <dl className="mt-3 grid grid-cols-2 border-y border-[#c1ced7] text-xs tabular-nums dark:border-[#29465d]">
        <div className="border-r border-[#c1ced7] py-2 pr-2 dark:border-[#29465d]">
          <dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#7890a2]">{previousLabel(indicator.frequency)}</dt>
          <dd className="mt-1 font-bold text-[#172b3b] dark:text-[#e8f0f6]">
            {indicator.previousPeriod ? formatComparison(indicator.previousPeriod, indicator.unit) : "—"}
          </dd>
        </div>
        <div className="py-2 pl-3">
          <dt className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#7890a2]">Aastatagusega</dt>
          <dd className="mt-1 font-bold text-[#172b3b] dark:text-[#e8f0f6]">
            {indicator.yearOverYear ? formatComparison(indicator.yearOverYear, indicator.unit) : "—"}
          </dd>
        </div>
      </dl>

      {indicator.benchmark && (
        <p className="mt-2 border-l-2 border-signal pl-2 text-[11px] leading-5 text-[#526878] dark:text-[#9aabb7]">
          Eesti samal perioodil <b>{formatEconomyValue(indicator.benchmark.value, indicator.unit)}</b> · vahe {indicator.benchmark.differencePercent > 0 ? "+" : ""}{indicator.benchmark.differencePercent.toFixed(1)}%
        </p>
      )}

      <div className="mt-auto pt-4 text-[10px] leading-4 text-[#7890a2]">
        <p title={indicator.classification.explanation}>{indicator.classification.basis}</p>
        <p>Allika uuendus: {formatSourceDate(indicator.source.updatedAt)}</p>
        <a href={indicator.source.tableUrl} target="_blank" rel="noreferrer" className="font-bold text-[#245fae] underline decoration-[#8aa9cf] underline-offset-2 outline-none hover:text-[#174a8d] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#7db0ff]">
          Statistikaamet · {indicator.source.tableId} ↗
        </a>
      </div>
    </article>
  );
}
