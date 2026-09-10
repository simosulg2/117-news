import type { ReactNode } from "react";

import { PageFooter } from "../../shell/client/page-footer";
import { PrimaryHeader } from "../../shell/client/primary-header";
import { formatTallinnTime } from "./market-formatters";

type MarketPageFrameProps = {
  theme: "light" | "dark";
  now: Date | null;
  availableCount: number;
  instrumentCount: number;
  canSignOut: boolean;
  onSignOut: () => Promise<void>;
  onToggleTheme: () => void;
  children: ReactNode;
};

export function MarketPageFrame({
  theme,
  now,
  availableCount,
  instrumentCount,
  canSignOut,
  onSignOut,
  onToggleTheme,
  children,
}: MarketPageFrameProps) {
  const complete = availableCount === instrumentCount;
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#market-main" className="fixed left-3 top-3 z-[60] -translate-y-24 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white">
        Liigu turuvõrdluse juurde
      </a>
      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <PrimaryHeader
            activeSection="market"
            tagline="Privaatne turuvõrdlus"
            statusText={`${availableCount}/${instrumentCount} hinnapaari`}
            statusHealthy={complete}
            clockText={now ? `${formatTallinnTime(now)} Eesti` : "--:--:-- Eesti"}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
          <div className="flex min-h-9 items-center justify-between gap-3 border-x border-[#263d50] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890a2]">
            <span>Yahoo turuandmed · privaatne vaade · käsitsi kinnitatav</span>
            {canSignOut ? (
              <form action={onSignOut}>
                <button type="submit" className="min-h-7 border-l border-[#263d50] px-3 font-bold text-[#a9b7c2] outline-none hover:bg-[#102538] hover:text-white focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal">
                  Logi välja
                </button>
              </form>
            ) : <span className="text-[#55d6b2]">Arendusrežiim</span>}
          </div>
        </div>
      </header>
      {children}
      <PageFooter label="Privaatne turuvõrdlus">
        Tehinguid ei saadeta automaatselt · Seda vaadet ei indekseerita
      </PageFooter>
    </div>
  );
}
