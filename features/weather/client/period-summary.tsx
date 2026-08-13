import { displayPhenomenon, formatNumber, sourceLabel } from "@/features/weather/client/weather-formatters";
import {
  average,
  maximum,
  minimum,
  sum,
  summarizePeriodPoints,
  type MetricSamples,
} from "@/features/weather/model/weather-client-model";
import { resolveTallinnLocalTime } from "@/lib/weather-time";
import type { WeatherPoint } from "@/lib/weather-types";

type PeriodSummaryProps = {
  points: WeatherPoint[];
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  maximumValue: string;
};

function sampleCoverage(samples: MetricSamples): string {
  const parts: string[] = [];
  if (samples.observedCount > 0) parts.push(`${samples.observedCount} mõõdetud ${samples.observedCount === 1 ? "näidis" : "näidist"}`);
  if (samples.modeledCount > 0) parts.push(`${samples.modeledCount} mudelinäidis${samples.modeledCount === 1 ? "" : "t"}`);
  return parts.length > 0 ? parts.join(" · ") : "näidised puuduvad";
}

export function PeriodSummary({ points, startValue, endValue, onStartChange, onEndChange, maximumValue }: PeriodSummaryProps) {
  const startResult = resolveTallinnLocalTime(startValue);
  const endResult = resolveTallinnLocalTime(endValue);
  const startMs = startResult.status === "valid" ? startResult.timestamp : null;
  const endMs = endResult.status === "valid" ? endResult.timestamp : null;
  const hasNonexistentTime = startResult.status === "nonexistent" || endResult.status === "nonexistent";
  const hasAmbiguousTime = (startResult.status === "valid" && startResult.ambiguous)
    || (endResult.status === "valid" && endResult.ambiguous);
  const valid = startMs !== null && endMs !== null && startMs < endMs;
  const inclusiveEndMs = endMs === null ? null : endMs + 60_000 - 1;
  const period = valid && startMs !== null && inclusiveEndMs !== null
    ? summarizePeriodPoints(points, startMs, inclusiveEndMs)
    : summarizePeriodPoints([], 0, 0);
  const { selectedPoints, samples, phenomenonSamples, observedCount, modeledCount } = period;
  const phenomenon = displayPhenomenon(period.phenomenon);
  const temperature = samples.temperatureC;
  const humidity = samples.relativeHumidityPct;
  const precipitation = samples.precipitationMm;
  const wind = samples.windSpeedMs;
  const gust = samples.windGustMs;
  const cloud = samples.cloudCoverPct;
  const pressure = samples.pressureHpa;
  const intervalMinutes = valid && startMs !== null && endMs !== null
    ? Math.max(1, Math.round((endMs - startMs) / 60_000))
    : null;
  const summaries = [
    { label: "Temperatuur", value: temperature.values.length > 0 ? `${formatNumber(minimum(temperature.values), "°C")} / ${formatNumber(average(temperature.values), "°C")} / ${formatNumber(maximum(temperature.values), "°C")}` : "—", detail: "näidiste min / keskmine / max", kind: temperature.kind, coverage: sampleCoverage(temperature) },
    { label: "Õhuniiskus", value: formatNumber(average(humidity.values), "%", 0), detail: "näidiste keskmine", kind: humidity.kind, coverage: sampleCoverage(humidity) },
    { label: "Sademed", value: formatNumber(sum(precipitation.values), "mm"), detail: "valitud näidiste summa", kind: precipitation.kind, coverage: sampleCoverage(precipitation) },
    { label: "Tuul", value: formatNumber(average(wind.values), "m/s"), detail: `näidiste keskmine · puhang max ${formatNumber(maximum(gust.values), "m/s")}`, kind: wind.kind ?? gust.kind, coverage: `${sampleCoverage(wind)} · puhang: ${sampleCoverage(gust)}` },
    { label: "Pilvisus", value: phenomenon ?? formatNumber(average(cloud.values), "%", 0), detail: phenomenon && cloud.values.length > 0 ? `${cloud.kind ? sourceLabel(cloud.kind).toLocaleLowerCase("et-EE") : "andmed"} ${formatNumber(average(cloud.values), "%", 0)}` : "keskmine", kind: phenomenon ? "observed" as const : cloud.kind, coverage: phenomenon ? `${phenomenonSamples.length} mõõdetud nähtusenäidis${phenomenonSamples.length === 1 ? "" : "t"}${cloud.modeledCount > 0 ? ` · ${cloud.modeledCount} mudelinäidist` : ""}` : sampleCoverage(cloud) },
    { label: "Õhurõhk", value: formatNumber(average(pressure.values), "hPa"), detail: "näidiste keskmine", kind: pressure.kind, coverage: sampleCoverage(pressure) },
  ];

  return (
    <section aria-labelledby="period-heading" className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="grid gap-3 border-b border-[#bdcad3] px-3 py-3 dark:border-[#294154] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h2 id="period-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Ajavahemiku ülevaade</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">
            Vali sind huvitava ajavahemiku algus ja lõpp. Kokkuvõte põhineb valitud ilmajaama mõõtmistel või selgelt märgitud mudelinäidistel ning on ligikaudne.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-bold text-[#456070] dark:text-[#9aabb7]">
            Algus
            <input type="datetime-local" value={startValue} max={maximumValue} step={60} aria-describedby="period-timezone-note" onChange={(event) => onStartChange(event.target.value)} className="mt-1 block min-h-10 w-full border border-[#90a4b2] bg-white px-2 text-xs tabular-nums text-[#15232d] outline-none focus:border-signal focus:ring-1 focus:ring-signal dark:border-[#3b5870] dark:bg-[#07131f] dark:text-[#e5eef4]" />
          </label>
          <label className="text-[11px] font-bold text-[#456070] dark:text-[#9aabb7]">
            Lõpp
            <input type="datetime-local" value={endValue} max={maximumValue} step={60} aria-describedby="period-timezone-note" onChange={(event) => onEndChange(event.target.value)} className="mt-1 block min-h-10 w-full border border-[#90a4b2] bg-white px-2 text-xs tabular-nums text-[#15232d] outline-none focus:border-signal focus:ring-1 focus:ring-signal dark:border-[#3b5870] dark:bg-[#07131f] dark:text-[#e5eef4]" />
          </label>
        </div>
      </div>
      <p id="period-timezone-note" className="border-b border-[#d0dbe2] px-3 py-2 text-[10px] leading-4 text-[#5b6f7d] dark:border-[#24394a] dark:text-[#8da1b0]">
        Kellaajad on Eesti ajas. Mõõtmisi eelistatakse; puuduva näitaja juures kasutatakse ainult selgelt märgitud mudelandmeid.
      </p>
      {hasAmbiguousTime && <p role="status" className="border-b border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">Valitud kellaaeg kordub sügisesel kellakeeramisel. Kokkuvõttes kasutatakse selle kellaaja esimest esinemist.</p>}
      {!startValue || !endValue ? (
        <p className="px-3 py-4 text-xs text-[#526878] dark:text-[#8da1b0]">Vali ajavahemiku algus ja lõpp.</p>
      ) : hasNonexistentTime ? (
        <p role="alert" className="px-3 py-4 text-xs font-semibold text-[#9d2f2f] dark:text-[#ff6b63]">Valitud kellaaega ei eksisteeri Eesti ajavööndis kevadise kellakeeramise tõttu. Vali teine kellaaeg.</p>
      ) : !valid ? (
        <p role="alert" className="px-3 py-4 text-xs font-semibold text-[#9d2f2f] dark:text-[#ff6b63]">Vali korrektne ajavahemik: lõpp peab olema algusest hilisem.</p>
      ) : points.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[#526878] dark:text-[#8da1b0]">Ajavahemiku kokkuvõtte jaoks pole ajalooandmed praegu saadaval.</p>
      ) : selectedPoints.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[#526878] dark:text-[#8da1b0]">Selle ajavahemiku kohta ei leitud mõõte- ega mudelandmeid.</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-6">
            {summaries.map((summary) => (
              <div key={summary.label} className="border-b border-r border-[#d0dbe2] px-3 py-3 last:border-r-0 dark:border-[#24394a] xl:border-b-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#5b6f7d] dark:text-[#8da1b0]">{summary.label}</h3>
                  {summary.kind && <span className={`text-[9px] font-bold uppercase ${summary.kind === "observed" ? "text-[#087663] dark:text-[#55d6b2]" : "text-[#60459f] dark:text-[#c7b8ff]"}`}>{sourceLabel(summary.kind)}</span>}
                </div>
                <p className="mt-2 text-sm font-bold tabular-nums text-[#15232d] dark:text-[#edf4f8]">{summary.value}</p>
                <p className="mt-1 text-[10px] text-[#5b6f7d] dark:text-[#8da1b0]">{summary.detail}</p>
                <p className="mt-1 text-[9px] font-semibold text-[#456070] dark:text-[#9aabb7]">Katvus: {summary.coverage}</p>
              </div>
            ))}
          </div>
          <p className="border-t border-[#d0dbe2] px-3 py-2 text-[11px] text-[#526878] dark:border-[#24394a] dark:text-[#8da1b0]">
            Andmekatvus {intervalMinutes !== null ? `${intervalMinutes} minuti kohta` : ""}: <b>{observedCount} mõõdetud ajapunkti</b>{modeledCount > 0 ? ` · ${modeledCount} mudelipunkti` : ""}. Väärtused on näidisepõhised ja ligikaudsed; mudelit ei esitata mõõtmisena.
          </p>
        </>
      )}
    </section>
  );
}
