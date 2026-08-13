import type { ReactNode } from "react";

import { PageFooter } from "@/features/shell/client/page-footer";
import { PrimaryHeader } from "@/features/shell/client/primary-header";

const clockFormatter = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

type NowPageFrameProps = {
  children: ReactNode;
  theme: "light" | "dark";
  now: Date | null;
  sourceCount: { available: number; total: number; healthy: boolean } | null;
  onToggleTheme: () => void;
  onMarkAllSeen: () => void;
  onResetSeen: () => void;
};

export function NowPageFrame({ children, theme, now, sourceCount, onToggleTheme, onMarkAllSeen, onResetSeen }: NowPageFrameProps) {
  return (
    <div className="min-h-screen">
      <a href="#now-main" className="sr-only fixed left-3 top-3 z-[100] bg-white px-3 py-2 text-sm font-bold text-[#172b3b] focus:not-sr-only">Liigu põhisisu juurde</a>
      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <PrimaryHeader
            activeSection="now"
            tagline="Minu Eesti infopult"
            statusText={sourceCount ? `${sourceCount.available}/${sourceCount.total} valdkonda` : "—/— valdkonda"}
            statusHealthy={Boolean(sourceCount?.healthy)}
            clockText={now ? `${clockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
          <div className="flex min-h-8 items-center justify-between gap-3 border-x border-[#263d50] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890a2]">
            <span>Uus pärast viimast külastust</span>
            <span className="flex gap-3">
              <button type="button" onClick={onMarkAllSeen} disabled={!sourceCount} className="font-bold text-[#9fb0bd] underline underline-offset-2 outline-none hover:text-white focus-visible:ring-1 focus-visible:ring-signal disabled:opacity-40">Märgi kõik nähtuks</button>
              <button type="button" onClick={onResetSeen} className="font-bold text-[#9fb0bd] underline underline-offset-2 outline-none hover:text-white focus-visible:ring-1 focus-visible:ring-signal">Lähtesta Praegu ajalugu</button>
            </span>
          </div>
        </div>
      </header>
      {children}
      <PageFooter label="Minu Eesti infopult">Kõik jälgimiseelistused ja nähtud olek püsivad ainult selles brauseris.</PageFooter>
    </div>
  );
}
