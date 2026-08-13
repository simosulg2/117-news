import type { ReactNode } from "react";

import { PageFooter } from "@/features/shell/client/page-footer";
import { PrimaryHeader } from "@/features/shell/client/primary-header";

import { economyClockFormatter } from "./economy-formatters";

type EconomyPageFrameProps = {
  theme: "light" | "dark";
  now: Date | null;
  statusText: string;
  statusHealthy: boolean;
  onToggleTheme: () => void;
  children: ReactNode;
};

export function EconomyPageFrame({
  theme,
  now,
  statusText,
  statusHealthy,
  onToggleTheme,
  children,
}: EconomyPageFrameProps) {
  return (
    <div className="min-h-screen">
      <a href="#economy-main" className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white">
        Liigu majandusandmete juurde
      </a>
      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <PrimaryHeader
            activeSection="economy"
            tagline="Eesti majanduslaud"
            statusText={statusText}
            statusHealthy={statusHealthy}
            statusAriaLive
            clockText={now ? `${economyClockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
          <div className="flex min-h-8 items-center justify-between gap-3 border-x border-[#263d50] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890a2]">
            <span>Statistikaamet · ametlikud andmed</span>
            <span className="hidden tabular-nums sm:inline">Kuu- ja kvartalinäitajad · Eesti + Võrumaa</span>
          </div>
        </div>
      </header>
      {children}
      <PageFooter label="Eesti majanduslaud">
        <span>
          Allikas ja atribuut: Statistikaamet · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="underline underline-offset-2">CC BY-SA 4.0</a> · tuletatud muutused: 117.ee
        </span>
      </PageFooter>
    </div>
  );
}
