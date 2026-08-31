import { deriveWeeklyMetricPercentages } from "@/features/schedule/model/schedule-metrics";
import type { ScheduleData } from "@/lib/schedule-types";

import { formatHours } from "./schedule-formatters";

export function BalanceView({ data }: { data: ScheduleData }) {
  const breakdown = deriveWeeklyMetricPercentages(data.metrics);
  return (
    <div>
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Nädala jaotus</p>
        <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Tasakaal</h2>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0]">Planeeritud valdkondade osakaal ja tunnid.</p>
      </div>

      <div className="mt-4 border border-[#aebcc6] bg-white dark:border-[#29485f] dark:bg-[#0b1b29]">
        <div className="flex items-end justify-between gap-3 border-b border-[#bdc9d1] bg-[#dfe8ee] px-4 py-3 dark:border-[#29485f] dark:bg-[#102538]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#617786] dark:text-[#8da1b0]">Kokku kaardistatud</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#172634] dark:text-[#edf4f8]">{formatHours(breakdown.totalHours)}</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#617786] dark:text-[#7890a2]">100% valitud mõõdikutest</p>
        </div>

        {breakdown.metrics.length ? (
          <div className="divide-y divide-[#d5dee4] dark:divide-[#263d50]">
            {breakdown.metrics.map((metric) => (
              <article key={metric.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-[#172634] dark:text-[#edf4f8]">{metric.label}</h3>
                    {metric.detail && <p className="mt-0.5 text-[11px] leading-4 text-[#617786] dark:text-[#8da1b0]">{metric.detail}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black tabular-nums text-[#174b8d] dark:text-signal">{formatHours(metric.hours)}</p>
                    <p className="text-[10px] font-bold tabular-nums text-[#617786] dark:text-[#7890a2]">{metric.percentage}%</p>
                  </div>
                </div>
                <div className="mt-3 h-2.5 border border-[#9fb2c0] bg-[#e5ecef] dark:border-[#35536a] dark:bg-[#102538]" aria-hidden="true">
                  <div className="h-full bg-[#245fae] dark:bg-signal" style={{ width: `${Math.min(100, Math.max(0, metric.percentage))}%` }} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-[#617786] dark:text-[#9bb0bf]">Tasakaalu mõõdikuid pole lisatud.</p>
        )}
      </div>
    </div>
  );
}
