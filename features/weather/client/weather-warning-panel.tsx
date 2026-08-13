"use client";

import { useCallback, useEffect, useState } from "react";

import { WatchToggle } from "@/features/watchlist/client/watch-toggle";
import type { WeatherWarningsResponse } from "@/lib/weather-warning-types";
import { visibleWeatherWarnings, weatherWarningPhase } from "@/lib/weather-warnings";

const timeFormatter = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

export function WeatherWarningPanel() {
  const [data, setData] = useState<WeatherWarningsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState(0);

  const load = useCallback(async () => {
    setCheckedAt(Date.now());
    try {
      const response = await fetch("/api/weather/warnings", { cache: "no-store" });
      if (!response.ok) throw new Error("Hoiatuste allikas ei vastanud.");
      setData(await response.json() as WeatherWarningsResponse);
      setError(null);
    } catch {
      setError("Võrumaa ametlikke ilmahoiatusi ei saanud kontrollida.");
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 10 * 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const nowMs = Date.now();
    const nextBoundary = data.warnings.flatMap((warning) => [warning.validFrom, warning.validTo])
      .map((value) => value ? Date.parse(value) : Number.NaN)
      .filter((value) => Number.isFinite(value) && value > nowMs)
      .sort((left, right) => left - right)[0];
    if (nextBoundary === undefined) return;
    const timeout = window.setTimeout(
      () => setCheckedAt(Date.now()),
      Math.min(nextBoundary - nowMs + 100, 2_147_000_000),
    );
    return () => window.clearTimeout(timeout);
  }, [checkedAt, data]);

  const warnings = data ? visibleWeatherWarnings(data.warnings, checkedAt || Date.parse(data.fetchedAt)) : [];
  const activeWarnings = warnings.filter((warning) => weatherWarningPhase(warning, checkedAt || Date.parse(data?.fetchedAt ?? "")) === "active");
  const highestActiveLevel = activeWarnings.reduce((level, warning) => Math.max(level, warning.level ?? 0), 0);
  return (
    <section aria-labelledby="weather-warning-heading" className={`border ${highestActiveLevel >= 2 ? "border-[#b54a55] bg-[#a52431]/5 dark:border-[#d85a66]" : highestActiveLevel === 1 ? "border-[#b18432] bg-[#d68b20]/5 dark:border-[#8f6728]" : "border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-inherit px-3 py-2">
        <div>
          <h2 id="weather-warning-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Võrumaa ilmahoiatused</h2>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.07em] text-[#607583] dark:text-[#7890a2]">Keskkonnaagentuur · ametlik hoiatusvoog</p>
        </div>
        <WatchToggle kind="weather-warning" targetId="vorumaa" label="Võrumaa ametlikud ilmahoiatused" compact />
      </div>
      {error ? (
        <div role="alert" className="flex items-center justify-between gap-3 px-3 py-3 text-xs text-[#805818] dark:text-[#efb860]">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-bold underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-signal">Proovi uuesti</button>
        </div>
      ) : !data ? (
        <p role="status" aria-live="polite" className="px-3 py-3 text-xs text-[#607583] dark:text-[#8da1b0]">Kontrollin aktiivseid hoiatusi…</p>
      ) : warnings.length === 0 ? (
        <p className="px-3 py-3 text-xs font-semibold text-[#35685d] dark:text-[#65cdb1]">Aktiivseid ega tulevasi Võrumaa või üleriigilisi hoiatusi ei ole.</p>
      ) : (
        <div className="divide-y divide-[#d0dbe2] dark:divide-[#24394a]">
          {warnings.map((warning) => {
            const phase = weatherWarningPhase(warning, checkedAt || Date.parse(data!.fetchedAt));
            return (
              <article key={`${warning.id}:${warning.revisionId}`} className="grid gap-1 px-3 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-start sm:gap-3">
                <div className="grid gap-0.5">
                  <b className={`${phase === "active" && warning.level !== null && warning.level >= 2 ? "text-[#9d2733] dark:text-[#ff929d]" : phase === "active" && warning.level === 1 ? "text-[#805818] dark:text-[#efb860]" : "text-[#405767] dark:text-[#a9b7c2]"}`}>
                    {warning.level === null ? "Tase määramata" : `Tase ${warning.level}`}
                  </b>
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#245fae] dark:text-[#7db0ff]">
                    {phase === "upcoming" ? "Tulekul" : "Kehtib praegu"}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.06em] text-[#607583] dark:text-[#8da1b0]">{warning.area}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">{warning.phenomenon}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#405767] dark:text-[#a9b7c2]">{warning.description}</p>
                </div>
                <span className="text-[10px] tabular-nums text-[#607583] dark:text-[#8da1b0]">
                  {phase === "upcoming" && warning.validFrom ? `Algab ${timeFormatter.format(new Date(warning.validFrom))}` : warning.validTo ? `Kuni ${timeFormatter.format(new Date(warning.validTo))}` : "Kehtib"}
                </span>
              </article>
            );
          })}
        </div>
      )}
      <div className="border-t border-inherit px-3 py-2 text-[10px] text-[#607583] dark:text-[#7890a2]">
        <a href={data?.source.documentationUrl ?? "https://keskkonnaportaal.ee/et/avaandmed/ilmaprognoosid"} className="font-semibold underline underline-offset-2 hover:text-[#245fae] dark:hover:text-[#7db0ff]">Allikas ja metoodika</a> · CC BY 4.0
      </div>
    </section>
  );
}
