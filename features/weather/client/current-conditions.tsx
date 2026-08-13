import {
  dateTimeFormatter,
  displayPhenomenon,
  formatNumber,
  sourceLabel,
} from "@/features/weather/client/weather-formatters";
import { METRICS } from "@/features/weather/model/weather-client-model";
import type { WeatherResponse } from "@/lib/weather-types";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function WeatherLoadingState() {
  return (
    <div role="status" aria-label="Ilmaandmete laadimine" className="space-y-4">
      <span className="sr-only">Laadin Võru ilmaandmeid…</span>
      <div className="grid border-y border-[#9fb2c0] dark:border-[#35536a] sm:grid-cols-3 lg:grid-cols-6">
        {METRICS.map((metric) => (
          <div key={metric.id} className="min-h-24 border-b border-r border-[#bdcad3] p-3 last:border-r-0 dark:border-[#294154] sm:border-b-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-7 w-24" />
            <Skeleton className="mt-3 h-2.5 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="border border-[#9fb2c0] p-3 dark:border-[#35536a]">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-5 h-36 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CurrentMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 border-b border-r border-[#bdcad3] px-3 py-3 last:border-r-0 dark:border-[#294154] sm:border-b-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#5b6f7d] dark:text-[#8da1b0]">{label}</dt>
      <dd className="mt-1.5 truncate text-xl font-bold tabular-nums text-[#15232d] dark:text-[#edf4f8]">{value}</dd>
      {detail && <dd className="mt-1 truncate text-[11px] text-[#5b6f7d] dark:text-[#8da1b0]">{detail}</dd>}
    </div>
  );
}

export function CurrentConditions({ data, stale }: { data: WeatherResponse; stale: boolean }) {
  const point = data.current;
  if (!point) {
    return (
      <section aria-labelledby="current-heading" className="border-y border-[#9d762f] bg-[#d68b20]/5 px-3 py-4 dark:border-[#8f6728]">
        <h2 id="current-heading" className="text-sm font-bold text-[#805818] dark:text-[#efb860]">Praegune mõõtmine pole saadaval</h2>
        <p className="mt-1 text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">
          Ajalugu ja prognoos võivad siiski töötada. Praegust väärtust ei asendata märkamatult mudelandmetega.
        </p>
      </section>
    );
  }

  const cloudDescription = displayPhenomenon(point.phenomenon) || formatNumber(point.cloudCoverPct, "%", 0);
  const windDetail = point.windGustMs === null ? undefined : `puhang ${formatNumber(point.windGustMs, "m/s")}`;

  return (
    <section aria-labelledby="current-heading" className="border-y border-[#9fb2c0] bg-[#eef3f6] dark:border-[#35536a] dark:bg-[#0b1b29]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#bdcad3] px-3 py-2 dark:border-[#294154]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="current-heading" className="text-sm font-bold text-[#245fae] dark:text-[#7db0ff]">Praegu Võrus</h2>
          <span className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
            point.kind === "observed"
              ? "border-[#29806c] bg-[#087663]/10 text-[#087663] dark:text-[#55d6b2]"
              : "border-[#7964bd] bg-[#6f56b3]/10 text-[#60459f] dark:text-[#c7b8ff]"
          }`}>
            {sourceLabel(point.kind)}
          </span>
          {stale && (
            <span className="border border-[#9d762f] bg-[#d68b20]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
              Värskendus hilineb
            </span>
          )}
        </div>
        <time dateTime={point.time} className="text-[11px] tabular-nums text-[#526878] dark:text-[#8da1b0]">
          {dateTimeFormatter.format(new Date(point.time))} Eesti aja järgi
        </time>
      </div>
      <dl className="grid sm:grid-cols-3 lg:grid-cols-6">
        <CurrentMetric label="Temperatuur" value={formatNumber(point.temperatureC, "°C")} detail={point.apparentTemperatureC === null ? undefined : `tajutav ${formatNumber(point.apparentTemperatureC, "°C")}`} />
        <CurrentMetric label="Ilm / pilvisus" value={cloudDescription} detail={point.cloudCoverPct === null ? undefined : formatNumber(point.cloudCoverPct, "%", 0)} />
        <CurrentMetric label="Õhuniiskus" value={formatNumber(point.relativeHumidityPct, "%", 0)} />
        <CurrentMetric label="Tuul" value={formatNumber(point.windSpeedMs, "m/s")} detail={windDetail} />
        <CurrentMetric label="Sademed" value={formatNumber(point.precipitationMm, "mm")} detail="viimase tunni sademed" />
        <CurrentMetric label="Õhurõhk" value={formatNumber(point.pressureHpa, "hPa")} />
      </dl>
    </section>
  );
}
