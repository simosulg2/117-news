import { WeatherRadar } from "@/components/weather-radar";

export function WeatherRadarSection() {
  return (
    <section aria-labelledby="radar-heading" className="mt-5">
      <div className="mb-2 border-y border-[#9fb2c0] bg-[#d5e0e7] px-3 py-2 dark:border-[#35536a] dark:bg-[#102538]">
        <h2 id="radar-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Sademeradar</h2>
        <p className="mt-0.5 text-[11px] text-[#526878] dark:text-[#8da1b0]">Radar laadib ilma mõõtegraafikutest sõltumatult.</p>
      </div>
      <WeatherRadar />
    </section>
  );
}
