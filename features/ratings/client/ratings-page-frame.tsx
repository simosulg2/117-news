import type { ReactNode } from "react";

import { clockFormatter } from "./ratings-formatters";
import { PoliticsNav } from "@/features/politics/client/politics-nav";
import { PageFooter } from "@/features/shell/client/page-footer";
import { PrimaryHeader } from "@/features/shell/client/primary-header";

type RatingsPageFrameProps = {
  theme: "light" | "dark";
  now: Date | null;
  hasData: boolean;
  onToggleTheme: () => void;
  children: ReactNode;
};

export function RatingsPageFrame({
  theme,
  now,
  hasData,
  onToggleTheme,
  children,
}: RatingsPageFrameProps) {
  return (
    <div className="min-h-screen">
      <a
        href="#ratings-main"
        className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white"
      >
        Liigu reitingute juurde
      </a>

      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <PrimaryHeader
            activeSection="politics"
            tagline="Eesti reitingulaud"
            statusText={hasData ? "1/1 allikas" : "—/1 allikas"}
            statusHealthy={hasData}
            clockText={now ? `${clockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />

          <PoliticsNav activePage="ratings" />
          <div className="flex min-h-8 items-center justify-between gap-3 border-x border-t border-[#263d50] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890a2]">
            <span>Norstat · 4 nädala koond</span>
            <span className="sm:hidden" aria-live="polite">{hasData ? "1/1 allikas" : "—/1 allikas"}</span>
            <span className="hidden tabular-nums sm:inline">5% künnis · 101 kohta · enamus 51</span>
          </div>
        </div>
      </header>

      {children}

      <PageFooter label="Eesti reitingulaud">
        Allikas: Ühiskonnauuringute Instituut / Norstat · Projektsioon ei ole valimistulemus
      </PageFooter>
    </div>
  );
}
