import type { EconomyResponse } from "@/lib/economy-types";

import { EconomyIndicatorCard } from "./economy-indicator-card";
import { EconomySummary } from "./economy-summary";

type EconomyDashboardProps = {
  data: EconomyResponse;
};

export function EconomyDashboard({ data }: EconomyDashboardProps) {
  return (
    <>
      <EconomySummary data={data} />
      <div className="space-y-4">
        {data.groups.map((group) => (
          <section key={group.id} aria-labelledby={`economy-group-${group.id}`}>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b border-[#9fb2c0] pb-1.5 dark:border-[#35536a]">
              <div>
                <h2 id={`economy-group-${group.id}`} className="font-display text-base font-bold text-[#172b3b] dark:text-[#e8f0f6]">{group.label}</h2>
                <p className="text-[11px] text-[#526878] dark:text-[#8da1b0]">{group.description}</p>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-[0.08em] ${group.status === "ok" ? "text-[#107052] dark:text-[#55d6b2]" : group.status === "stale" ? "text-[#805818] dark:text-[#efb860]" : "text-[#a02d28] dark:text-[#ff7d76]"}`}>
                {group.status === "ok" ? "Allikas korras" : group.status === "stale" ? "Vananenud koopia" : "Allikas maas"}
              </span>
            </div>
            {group.message && (
              <p role={group.status === "failed" ? "alert" : "status"} className="mb-2 border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
                {group.message}
              </p>
            )}
            {group.indicators.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {group.indicators.map((indicator) => <EconomyIndicatorCard key={indicator.id} indicator={indicator} />)}
              </div>
            ) : (
              <div className="border border-dashed border-[#9fb2c0] px-3 py-8 text-center text-xs text-[#7890a2] dark:border-[#35536a]">
                Selle grupi andmeid ei ole praegu saadaval.
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
