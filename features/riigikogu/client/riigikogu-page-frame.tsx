import type { ReactNode } from "react";
import { PoliticsNav } from "@/features/politics/client/politics-nav";
import { PageFooter } from "@/features/shell/client/page-footer";
import { PrimaryHeader } from "@/features/shell/client/primary-header";
import { clockFormatter } from "./riigikogu-formatters";

type Props = {
  theme: "light" | "dark";
  now: Date | null;
  sourceHealthy: boolean;
  sourceText: string;
  onToggleTheme: () => void;
  children: ReactNode;
};

export function RiigikoguPageFrame({ theme, now, sourceHealthy, sourceText, onToggleTheme, children }: Props) {
  return <div className="min-h-screen">
    <a href="#riigikogu-main" className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white">
      Liigu Riigikogu ülevaate juurde
    </a>
    <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
      <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
        <PrimaryHeader
          activeSection="politics" tagline="Riigikogu töölaud" statusText={sourceText}
          statusHealthy={sourceHealthy} clockText={now ? `${clockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}
          theme={theme} onToggleTheme={onToggleTheme}
        />
        <PoliticsNav activePage="parliament" />
      </div>
    </header>
    {children}
    <PageFooter label="Riigikogu töölaud">
      Allikas: Riigikogu Kantselei avaandmed · CC BY-SA 3.0 · Kuvatud faktid pärinevad ametlikust API-st
    </PageFooter>
  </div>;
}
