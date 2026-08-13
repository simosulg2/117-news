import type { WeatherResponse } from "@/lib/weather-types";

export function WeatherFooter({ data }: { data: WeatherResponse | null }) {
  return (
    <footer className="border-t border-[#9fb2c0] bg-[#dfe8ee] dark:border-[#35536a] dark:bg-[#0b1b29]">
      <div className="mx-auto flex max-w-[96rem] flex-col gap-2 px-3 py-3 text-[11px] text-[#526878] dark:text-[#7890a2] sm:px-5 lg:px-7">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span><b className="text-[#245fae] dark:text-signal">117.ee</b> · Võru ilmatöölaud</span>
          <a href="https://www.ilmateenistus.ee/ilm/ilmavaatlused/radar/" target="_blank" rel="noopener noreferrer external" className="font-semibold underline underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]">Ava ametlik radar</a>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(data?.attributions ?? []).map((attribution) => <a key={attribution.source} href={attribution.url} target="_blank" rel="noopener noreferrer external" className="underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]">{attribution.label}{attribution.license ? ` · ${attribution.license}` : ""}</a>)}
          {!data && (
            <>
              <a href="https://www.ilmateenistus.ee/" target="_blank" rel="noopener noreferrer external" className="underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]">Keskkonnaagentuur / Ilmateenistus</a>
              <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer external" className="underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]">Open-Meteo · CC BY 4.0</a>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
