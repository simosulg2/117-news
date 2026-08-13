import { shortTimeFormatter } from "@/features/weather/client/weather-formatters";
import type { WeatherResponse } from "@/lib/weather-types";

type WeatherStatusProps = {
  data: WeatherResponse | null;
  refreshing: boolean;
  stale: boolean;
  failedSources: WeatherResponse["sources"];
  error: string | null;
  refreshError: string | null;
  onRetry: () => void;
};

export function WeatherStatus({ data, refreshing, stale, failedSources, error, refreshError, onRetry }: WeatherStatusProps) {
  return (
    <>
      <div className="mb-3 grid gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 text-xs font-semibold text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2] sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><h1 className="font-bold text-[#245fae] dark:text-signal">Võru ilm</h1><span>Mõõtmised · ajalugu · prognoos · radar</span></div>
        <span aria-live="polite" className={`tabular-nums ${stale ? "text-[#805818] dark:text-[#efb860]" : ""}`}>{refreshing ? "Värskendan ilmaandmeid…" : data ? `${stale ? "Andmed vananenud · " : ""}Koostatud ${shortTimeFormatter.format(new Date(data.generatedAt)).replace(",", "")}` : "Andmeid laaditakse"}</span>
      </div>
      {failedSources.length > 0 && data && <div role="status" className="mb-3 border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs leading-5 text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]"><b>Osalised andmed:</b> {failedSources.map((source) => source.label).join(", ")} ei vasta. Töötavad osad jäävad kasutatavaks ja puuduvad väärtused on märgitud kriipsuga.</div>}
      {error && (
        <div role="alert" className="mb-3 flex flex-col gap-3 border border-[#9d2f2f] bg-[#b42318]/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-bold text-[#b42318] dark:text-[#ff6b63]">Ilmaandmete laadimine ebaõnnestus</p><p className="mt-1 text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">{error}</p></div>
          <button type="button" onClick={onRetry} className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-xs font-semibold text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]">Proovi uuesti</button>
        </div>
      )}
      {data && refreshError && (
        <div role="status" className="mb-3 flex flex-col gap-2 border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs leading-5 text-[#805818] dark:border-[#8f6728] dark:text-[#efb860] sm:flex-row sm:items-center sm:justify-between">
          <span><b>Värskendus hilineb:</b> {refreshError}</span>
          <button type="button" onClick={onRetry} className="min-h-9 w-fit shrink-0 border border-[#9d762f] px-3 font-semibold outline-none hover:bg-[#d68b20]/10 focus-visible:ring-2 focus-visible:ring-[#d68b20] dark:border-[#8f6728]">Proovi kohe</button>
        </div>
      )}
    </>
  );
}
