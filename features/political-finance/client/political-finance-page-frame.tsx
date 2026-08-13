import type { ReactNode } from "react";

import { PoliticsNav } from "../../politics/client/politics-nav";
import { PageFooter } from "../../shell/client/page-footer";
import { PrimaryHeader } from "../../shell/client/primary-header";
import { clockFormatter } from "./political-finance-formatters";

type Props = {
  children: ReactNode;
  theme: "light" | "dark";
  now: Date | null;
  healthy: boolean;
  onToggleTheme: () => void;
};

export function PoliticalFinancePageFrame({ children, theme, now, healthy, onToggleTheme }: Props) {
  return (
    <div className="min-h-screen">
      <a href="#political-finance-main" className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white">
        Liigu rahastamisandmete juurde
      </a>
      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <PrimaryHeader
            activeSection="politics"
            tagline="Poliitika andmelaud"
            statusText={healthy ? "ERJK ühendatud" : "ERJK ootel"}
            statusHealthy={healthy}
            clockText={now ? `${clockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
          <PoliticsNav activePage="finance" />
        </div>
      </header>
      {children}
      <PageFooter label="Erakondade raha">
        <span>
          Allikas: <a className="underline underline-offset-2 hover:text-signal" href="https://www.erjk.ee/et/avaandmetest" target="_blank" rel="noreferrer">ERJK</a>
          {" · "}<a className="underline underline-offset-2 hover:text-signal" href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>
        </span>
      </PageFooter>
    </div>
  );
}
