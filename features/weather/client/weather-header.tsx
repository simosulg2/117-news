import { clockFormatter, shortTimeFormatter } from "@/features/weather/client/weather-formatters";
import { PrimaryHeader } from "@/features/shell/client/primary-header";
import type { WeatherResponse } from "@/lib/weather-types";

type WeatherHeaderProps = {
  data: WeatherResponse | null;
  failedSourceCount: number;
  workingSourceCount: number;
  now: Date | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function WeatherHeader({ data, failedSourceCount, workingSourceCount, now, theme, onToggleTheme }: WeatherHeaderProps) {
  return (
    <>
      <a href="#weather-main" className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white">Liigu ilmaandmete juurde</a>
      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <PrimaryHeader
            activeSection="weather"
            tagline="Võru ilmatöölaud"
            statusText={data ? `${workingSourceCount}/${data.sources.length} allikat` : "—/— allikat"}
            statusHealthy={Boolean(data && failedSourceCount === 0)}
            clockText={now ? `${clockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
          <div className="flex min-h-8 items-center justify-between gap-3 border-x border-[#263d50] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890a2]">
            <span>Võru vaatlusjaam · WMO 26249</span>
            <span className="sm:hidden" aria-live="polite">{data ? `${workingSourceCount}/${data.sources.length} allikat` : "—/— allikat"}</span>
            <span className="hidden tabular-nums sm:inline">{data?.current ? `Vaatlus ${shortTimeFormatter.format(new Date(data.current.time)).replace(",", "")}` : "Vaatlus laadimisel"}</span>
          </div>
        </div>
      </header>
    </>
  );
}
