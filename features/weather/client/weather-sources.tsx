import { shortTimeFormatter } from "@/features/weather/client/weather-formatters";
import type { WeatherResponse } from "@/lib/weather-types";

export function WeatherSources({ data }: { data: WeatherResponse }) {
  return (
    <section aria-labelledby="sources-heading" className="mt-5 border border-[#9fb2c0] dark:border-[#35536a]">
      <div className="border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]"><h2 id="sources-heading" className="text-xs font-bold text-[#2d4353] dark:text-[#c2d0d9]">Andmeallikate olek</h2></div>
      <ul className="divide-y divide-[#d0dbe2] text-xs dark:divide-[#24394a]">
        {data.sources.map((source) => <li key={source.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_8rem_12rem] sm:items-center"><span className="font-semibold text-[#304654] dark:text-[#c2d0d9]">{source.label}</span><span className="text-[11px] text-[#5b6f7d] dark:text-[#8da1b0]">{source.kind === "observation" ? "Mõõtmine" : "Mudel"}</span><span className={`text-[11px] font-bold sm:text-right ${source.status === "ok" ? "text-[#087663] dark:text-[#55d6b2]" : "text-[#9d2f2f] dark:text-[#ff6b63]"}`}>{source.status === "ok" ? "TÖÖTAB" : "POLE SAADAVAL"}{source.updatedAt ? ` · ${shortTimeFormatter.format(new Date(source.updatedAt)).replace(",", "")}` : ""}</span></li>)}
      </ul>
    </section>
  );
}
