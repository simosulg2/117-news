import { dateTimeFormatter, formatNumber, sourceLabel, weatherSourceLabel } from "@/features/weather/client/weather-formatters";
import { fieldValue, type MetricDefinition } from "@/features/weather/model/weather-client-model";
import type { WeatherPoint } from "@/lib/weather-types";

type MetricChartDetailsProps = {
  metric: MetricDefinition;
  chartPoints: WeatherPoint[];
  tablePoints: WeatherPoint[];
  inspectedPoints: WeatherPoint[];
  inspectionLabel: string | null;
  inspectionPinned: boolean;
  interactionHintId: string;
  inspectionReadoutId: string;
};

export function MetricChartDetails({
  metric,
  chartPoints,
  tablePoints,
  inspectedPoints,
  inspectionLabel,
  inspectionPinned,
  interactionHintId,
  inspectionReadoutId,
}: MetricChartDetailsProps) {
  return (
    <>
      <div id={inspectionReadoutId} className="border-t border-[#bdcad3] bg-white/50 px-3 py-2 text-[11px] leading-5 text-[#456070] dark:border-[#294154] dark:bg-[#07131f]/40 dark:text-[#9aabb7]">
        {inspectionLabel ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <time className="font-bold tabular-nums text-[#805818] dark:text-[#efb860]">{inspectionLabel} Eesti aeg{inspectionPinned ? " · kinnitatud" : ""}</time>
            {inspectedPoints.length > 0 ? inspectedPoints.map((point, index) => (
              <span key={`${point.kind}-${point.source}-${index}`}>
                <b className={point.kind === "observed" ? "text-[#087663] dark:text-[#55d6b2]" : "text-[#60459f] dark:text-[#c7b8ff]"}>{sourceLabel(point.kind)}</b>
                {` · ${formatNumber(fieldValue(point, metric.field), metric.unit)}`}
                {metric.secondaryField && fieldValue(point, metric.secondaryField) !== null ? ` · ${metric.secondaryLabel} ${formatNumber(fieldValue(point, metric.secondaryField), metric.unit)}` : ""}
                {` · ${weatherSourceLabel(point.source)}`}
              </span>
            )) : <span>Selle näitaja väärtus sel ajal puudub.</span>}
          </div>
        ) : (
          <span id={interactionHintId}>Täpsete väärtuste vaatamiseks liiguta kursorit graafikul või puuduta seda. Nooleklahvid liiguvad ajapunktide vahel.</span>
        )}
        {inspectionLabel && <span id={interactionHintId} className="sr-only">Nooleklahvid liiguvad ajapunktide vahel. Escape eemaldab valiku.</span>}
      </div>
      <details className="border-t border-[#bdcad3] text-xs dark:border-[#294154]">
        <summary className="cursor-pointer px-3 py-2 font-semibold text-[#456070] outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#9aabb7] dark:hover:text-[#7db0ff]">Ava ligipääsetav andmetabel</summary>
        <div className="max-h-72 overflow-auto border-t border-[#bdcad3] dark:border-[#294154]">
          <table className="w-full min-w-[28rem] border-collapse text-left tabular-nums">
            <thead className="sticky top-0 bg-[#dfe8ee] text-[11px] text-[#4b6170] dark:bg-[#102538] dark:text-[#9aabb7]">
              <tr>
                <th className="px-3 py-1.5">Aeg</th>
                <th className="px-3 py-1.5">Liik</th>
                <th className="px-3 py-1.5">{metric.shortTitle}</th>
                {metric.secondaryField && <th className="px-3 py-1.5">{metric.secondaryLabel}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d0dbe2] text-[#304654] dark:divide-[#24394a] dark:text-[#c2d0d9]">
              {tablePoints.map((point, index) => (
                <tr key={`${point.time}-${point.kind}-${index}`}>
                  <td className="whitespace-nowrap px-3 py-1.5">{dateTimeFormatter.format(new Date(point.time))}</td>
                  <td className="px-3 py-1.5">{sourceLabel(point.kind)}</td>
                  <td className="px-3 py-1.5">{formatNumber(fieldValue(point, metric.field), metric.unit)}</td>
                  {metric.secondaryField && <td className="px-3 py-1.5">{formatNumber(fieldValue(point, metric.secondaryField), metric.unit)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {tablePoints.length < chartPoints.length && <p className="px-3 py-2 text-[11px] text-[#5b6f7d] dark:text-[#8da1b0]">Tabelis on 240 viimast punkti. Pikema ajaloo kõik algandmed saab laadida CSV-failina.</p>}
        </div>
      </details>
    </>
  );
}
