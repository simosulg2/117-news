import { MetricChart } from "@/features/weather/client/metric-chart";
import { METRICS } from "@/features/weather/model/weather-client-model";
import type { WeatherPoint } from "@/lib/weather-types";

type WeatherChartsProps = {
  points: WeatherPoint[];
  visibleMetricIds: string[];
  onToggleMetric: (id: string) => void;
  startMs: number;
  endMs: number;
  nowMs: number;
  periodStartMs: number | null;
  periodEndMs: number | null;
  pinnedInspectionMs: number | null;
  previewInspectionMs: number | null;
  onInspectionPreview: (value: number | null) => void;
  onInspectionPin: (value: number | null) => void;
  inspectionAnnouncement: string | null;
};

export function WeatherCharts(props: WeatherChartsProps) {
  const inspectionMs = props.previewInspectionMs ?? props.pinnedInspectionMs;
  return (
    <section aria-labelledby="charts-heading">
      <p className="sr-only" aria-live="polite">{props.inspectionAnnouncement}</p>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3 border-y border-[#9fb2c0] bg-[#d5e0e7] px-3 py-2 dark:border-[#35536a] dark:bg-[#102538]">
        <div><h2 id="charts-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Ilmanäitajad</h2><p className="mt-0.5 text-[11px] text-[#526878] dark:text-[#8da1b0]">Pidev joon või täistulp = mõõtmine · katkendjoon või viirutatud tulp = mudel · sinine püstsirge = praegu · kollane püstsirge = valitud aeg</p></div>
        <div className="flex flex-wrap items-center justify-end gap-1" aria-label="Kuvatavad ilmanäitajad">
          {METRICS.map((metric) => {
            const active = props.visibleMetricIds.includes(metric.id);
            return <button key={metric.id} type="button" aria-pressed={active} onClick={() => props.onToggleMetric(metric.id)} className={`min-h-7 border px-2 text-[10px] font-bold outline-none focus-visible:ring-1 focus-visible:ring-signal ${active ? "border-[#58768b] bg-[#0b1b29] text-white dark:border-[#58768b]" : "border-[#9fb2c0] text-[#5b6f7d] hover:border-[#58768b] dark:border-[#35536a] dark:text-[#8da1b0]"}`}>{metric.shortTitle}</button>;
          })}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {METRICS.filter((metric) => props.visibleMetricIds.includes(metric.id)).map((metric) => <MetricChart key={metric.id} metric={metric} points={props.points} startMs={props.startMs} endMs={props.endMs} nowMs={props.nowMs} periodStartMs={props.periodStartMs} periodEndMs={props.periodEndMs} inspectionMs={inspectionMs} inspectionPinned={props.previewInspectionMs === null && props.pinnedInspectionMs !== null} onInspectionPreview={props.onInspectionPreview} onInspectionPin={props.onInspectionPin} />)}
      </div>
    </section>
  );
}
