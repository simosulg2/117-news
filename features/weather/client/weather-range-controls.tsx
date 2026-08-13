import { dateTimeFormatter } from "@/features/weather/client/weather-formatters";
import { shiftDate, type WeatherRange, type WeatherView } from "@/features/weather/model/weather-client-model";
import type { WeatherHistoryResponse } from "@/lib/weather-types";

type WeatherRangeControlsProps = {
  view: WeatherView;
  onViewChange: (view: WeatherView) => void;
  range: WeatherRange;
  onRangeChange: (range: WeatherRange) => void;
  selectedDate: string;
  onSelectedDateChange: (value: string) => void;
  selectedEndDate: string;
  onSelectedEndDateChange: (value: string) => void;
  todayInput: string;
  maximumCustomEndDate: string;
  windowStart: number;
  windowEnd: number;
  historyLoading: boolean;
  observedCount: number;
  modeledCount: number;
  extendedHistory: WeatherHistoryResponse | null;
  extendedHistoryMatches: boolean;
  needsExtendedHistory: boolean;
  historyCsvUrl: string | null;
  historyError: string | null;
};

export function WeatherRangeControls(props: WeatherRangeControlsProps) {
  const {
    view, onViewChange, range, onRangeChange, selectedDate, onSelectedDateChange,
    selectedEndDate, onSelectedEndDateChange, todayInput, maximumCustomEndDate,
    windowStart, windowEnd, historyLoading, observedCount, modeledCount,
    extendedHistory, extendedHistoryMatches, needsExtendedHistory, historyCsvUrl,
    historyError,
  } = props;
  return (
    <section aria-label="Ilmaajavahemiku valik" className="border border-[#9fb2c0] bg-[#0b1b29] dark:border-[#35536a]">
      <div className="grid lg:grid-cols-[auto_1fr]">
        <div className="no-scrollbar flex overflow-x-auto border-b border-[#263d50] lg:border-b-0 lg:border-r">
          {([ ["history", "Ajalugu"], ["now", "Praegu"], ["forecast", "Prognoos"] ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => { onViewChange(value); if (value !== "history" && (range === "30d" || range === "90d")) onRangeChange("7d"); }} aria-pressed={view === value} className={`min-h-11 shrink-0 border-r border-[#263d50] px-5 text-[13px] font-bold outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal ${view === value ? "bg-signal text-[#07131f]" : "text-[#a9b7c2] hover:bg-[#102538] hover:text-white"}`}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-stretch lg:justify-end">
          {(view === "history"
            ? ([ ["24h", "24 h"], ["3d", "3 p"], ["7d", "7 p"], ["30d", "30 p"], ["90d", "90 p"], ["date", "Kohandatud"] ] as const)
            : ([ ["24h", "24 h"], ["3d", "3 p"], ["7d", "7 p"], ["date", "Kuupäev"] ] as const)
          ).map(([value, label]) => <button key={value} type="button" onClick={() => onRangeChange(value)} aria-pressed={range === value} className={`min-h-11 border-r border-[#263d50] px-4 text-xs font-semibold outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal ${range === value ? "bg-[#dfe8ee] text-[#15232d] dark:bg-[#294154] dark:text-white" : "text-[#a9b7c2] hover:bg-[#102538] hover:text-white"}`}>{label}</button>)}
          {range === "date" && (
            <div className="flex min-h-11 flex-wrap items-center gap-2 px-3 text-[11px] font-bold text-[#a9b7c2]">
              <label className="flex items-center gap-1.5">
                <span className={view === "history" ? "" : "sr-only"}>{view === "history" ? "Alates" : "Valitud kuupäev"}</span>
                <input type="date" value={selectedDate} max={view === "history" ? [selectedEndDate || todayInput, todayInput].sort()[0] : undefined} onChange={(event) => {
                  const value = event.target.value;
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
                  onSelectedDateChange(value);
                  const nextMaximum = [shiftDate(value, 89), todayInput].sort()[0];
                  if (value > selectedEndDate) onSelectedEndDateChange(value);
                  else if (selectedEndDate > nextMaximum) onSelectedEndDateChange(nextMaximum);
                }} className="min-h-8 border border-[#3b5870] bg-[#07131f] px-2 text-xs tabular-nums text-white outline-none focus:border-signal focus:ring-1 focus:ring-signal" />
              </label>
              {view === "history" && <label className="flex items-center gap-1.5">Kuni<input type="date" value={selectedEndDate} min={selectedDate} max={maximumCustomEndDate} onChange={(event) => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) onSelectedEndDateChange(event.target.value); }} className="min-h-8 border border-[#3b5870] bg-[#07131f] px-2 text-xs tabular-nums text-white outline-none focus:border-signal focus:ring-1 focus:ring-signal" /></label>}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#263d50] px-3 py-2 text-[11px] text-[#8da1b0]">
        <span>{dateTimeFormatter.format(new Date(windowStart))} — {dateTimeFormatter.format(new Date(windowEnd))}</span>
        <span aria-live="polite" className="flex flex-wrap items-center gap-x-3">
          {historyLoading ? <b className="text-signal">Laadin pikemat ajalugu…</b> : <><b className="text-[#55d6b2]">{observedCount} mõõdetud</b>{modeledCount > 0 && <b className="text-[#c7b8ff]">{modeledCount} mudelipunkti</b>}{extendedHistory && extendedHistoryMatches && needsExtendedHistory && <span>{extendedHistory.resolution.mode === "hourly" ? "1 h koondvaade" : "detailvaade"}</span>}</>}
          {historyCsvUrl && (needsExtendedHistory ? Boolean(extendedHistory && extendedHistoryMatches && extendedHistory.points.length > 0) : observedCount > 0) && !historyLoading && !historyError && <a href={historyCsvUrl} download title="CSV sisaldab Keskkonnaagentuuri mõõteandmeid" className="border border-[#58768b] px-2 py-1 font-bold text-white outline-none hover:border-signal hover:text-signal focus-visible:ring-1 focus-visible:ring-signal">Laadi CSV</a>}
        </span>
      </div>
    </section>
  );
}
