"use client";

import { useEffect, useMemo, useState } from "react";

import { CurrentConditions, WeatherLoadingState } from "@/features/weather/client/current-conditions";
import { dateInputFormatter, dateTimeFormatter, toTallinnDateTimeInput } from "@/features/weather/client/weather-formatters";
import { PeriodSummary } from "@/features/weather/client/period-summary";
import { useThemeClock } from "@/features/weather/client/use-theme-clock";
import { useWeatherFeed } from "@/features/weather/client/use-weather-feed";
import { useWeatherHistory } from "@/features/weather/client/use-weather-history";
import { useWeatherPreferences } from "@/features/weather/client/use-weather-preferences";
import { WeatherCharts } from "@/features/weather/client/weather-charts";
import { WeatherFooter } from "@/features/weather/client/weather-footer";
import { WeatherHeader } from "@/features/weather/client/weather-header";
import { WeatherRadarSection } from "@/features/weather/client/weather-radar-section";
import { WeatherRangeControls } from "@/features/weather/client/weather-range-controls";
import { WeatherSources } from "@/features/weather/client/weather-sources";
import { WeatherStatus } from "@/features/weather/client/weather-status";
import { WeatherWarningPanel } from "@/features/weather/client/weather-warning-panel";
import {
  CURRENT_OBSERVATION_STALE_AFTER_MS,
  HOUR_MS,
  WEATHER_STALE_AFTER_MS,
  deduplicatePoints,
  filterPointsByWindow,
  rangeWindow,
  shiftDate,
} from "@/features/weather/model/weather-client-model";
import { resolveTallinnLocalTime } from "@/lib/weather-time";

export function WeatherPortal() {
  const feed = useWeatherFeed();
  const preferences = useWeatherPreferences();
  const { theme, now, toggleTheme } = useThemeClock();
  const [pinnedInspectionMs, setPinnedInspectionMs] = useState<number | null>(null);
  const [previewInspectionMs, setPreviewInspectionMs] = useState<number | null>(null);
  const data = feed.data;

  const allPoints = useMemo(() => data ? deduplicatePoints([
    ...data.history.observed,
    ...data.history.modeled,
    ...data.forecast,
    ...(data.current ? [data.current] : []),
  ]) : [], [data]);
  const historyPoints = useMemo(() => data ? deduplicatePoints([
    ...data.history.observed,
    ...data.history.modeled,
    ...(data.current?.kind === "observed" ? [data.current] : []),
  ]) : [], [data]);

  useEffect(() => {
    if (preferences.periodStart || preferences.periodEnd || historyPoints.length === 0) return;
    const observations = historyPoints.filter((point) => point.kind === "observed");
    const fallback = historyPoints.filter((point) => point.kind === "modeled");
    const candidates = observations.length > 0 ? observations : fallback;
    const latestSelectableMinute = Math.ceil(Date.now() / 60_000) * 60_000;
    const latestSelectablePoint = latestSelectableMinute + 60_000 - 1;
    const latest = Math.max(...candidates.map((point) => Date.parse(point.time)).filter((time) => Number.isFinite(time) && time <= latestSelectablePoint));
    if (!Number.isFinite(latest)) return;
    preferences.setPeriodStart(toTallinnDateTimeInput(latest - HOUR_MS));
    preferences.setPeriodEnd(toTallinnDateTimeInput(latest));
  }, [historyPoints, preferences.periodEnd, preferences.periodStart, preferences.setPeriodEnd, preferences.setPeriodStart]);

  const nowMs = now?.getTime() ?? Date.now();
  const visibleWindow = useMemo(
    () => rangeWindow(preferences.view, preferences.range, preferences.selectedDate, preferences.selectedEndDate, nowMs),
    [nowMs, preferences.range, preferences.selectedDate, preferences.selectedEndDate, preferences.view],
  );
  const needsExtendedHistory = preferences.view === "history" && (preferences.range === "30d" || preferences.range === "90d" || preferences.range === "date");
  const history = useWeatherHistory({
    enabled: needsExtendedHistory,
    range: preferences.range,
    selectedDate: preferences.selectedDate,
    selectedEndDate: preferences.selectedEndDate,
    visibleStartMs: visibleWindow.start,
    visibleEndMs: visibleWindow.end,
    nowMs,
  });

  const chartPoints = useMemo(() => {
    if (!data) return [];
    if (preferences.view === "history") {
      if (needsExtendedHistory) return deduplicatePoints(history.matchesScope ? history.extendedHistory?.points ?? [] : []);
      return historyPoints;
    }
    if (preferences.view === "forecast") return deduplicatePoints(data.forecast);
    return allPoints;
  }, [allPoints, data, history.extendedHistory, history.matchesScope, historyPoints, needsExtendedHistory, preferences.view]);
  const visiblePoints = useMemo(() => filterPointsByWindow(chartPoints, visibleWindow.start, visibleWindow.end), [chartPoints, visibleWindow.end, visibleWindow.start]);
  const visibleObservedCount = new Set(visiblePoints.filter((point) => point.kind === "observed").map((point) => point.time)).size;
  const visibleModeledCount = new Set(visiblePoints.filter((point) => point.kind === "modeled").map((point) => point.time)).size;
  const periodStartResult = resolveTallinnLocalTime(preferences.periodStart);
  const periodEndResult = resolveTallinnLocalTime(preferences.periodEnd);
  const periodStartMs = periodStartResult.status === "valid" ? periodStartResult.timestamp : null;
  const periodEndMs = periodEndResult.status === "valid" ? periodEndResult.timestamp : null;
  const periodEndInclusiveMs = periodEndMs === null ? null : periodEndMs + 60_000 - 1;
  const maximumPeriodInput = toTallinnDateTimeInput(Math.ceil(nowMs / 60_000) * 60_000);
  const todayInput = dateInputFormatter.format(new Date(nowMs));
  const maximumCustomEndDate = preferences.selectedDate ? [shiftDate(preferences.selectedDate, 89), todayInput].sort()[0] : todayInput;
  const failedSources = data?.sources.filter((source) => source.status === "error") ?? [];
  const workingSourceCount = data?.sources.filter((source) => source.status === "ok").length ?? 0;
  const generatedAtMs = data ? Date.parse(data.generatedAt) : Number.NaN;
  const currentObservationMs = data?.current ? Date.parse(data.current.time) : Number.NaN;
  const weatherIsStale = Boolean(data) && (!Number.isFinite(generatedAtMs) || nowMs - generatedAtMs > WEATHER_STALE_AFTER_MS || (Number.isFinite(currentObservationMs) && nowMs - currentObservationMs > CURRENT_OBSERVATION_STALE_AFTER_MS));
  const inspectionAnnouncement = pinnedInspectionMs === null ? null : `${dateTimeFormatter.format(new Date(pinnedInspectionMs))} Eesti aeg`;
  const summaryPoints = needsExtendedHistory && history.matchesScope ? history.extendedHistory?.points ?? [] : needsExtendedHistory ? [] : historyPoints;

  return (
    <div className="min-h-screen">
      <WeatherHeader data={data} failedSourceCount={failedSources.length} workingSourceCount={workingSourceCount} now={now} theme={theme} onToggleTheme={toggleTheme} />
      <main id="weather-main" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-12 pt-4 outline-none sm:px-5 lg:px-7">
        <WeatherStatus data={data} refreshing={feed.refreshing} stale={weatherIsStale} failedSources={failedSources} error={feed.error} refreshError={feed.refreshError} onRetry={feed.retry} />
        {!data && feed.loading && <WeatherLoadingState />}
        <div className="mb-4"><WeatherWarningPanel /></div>
        {data && (
          <div className="space-y-4">
            <CurrentConditions data={data} stale={weatherIsStale} />
            <WeatherRangeControls view={preferences.view} onViewChange={preferences.setView} range={preferences.range} onRangeChange={preferences.setRange} selectedDate={preferences.selectedDate} onSelectedDateChange={preferences.setSelectedDate} selectedEndDate={preferences.selectedEndDate} onSelectedEndDateChange={preferences.setSelectedEndDate} todayInput={todayInput} maximumCustomEndDate={maximumCustomEndDate} windowStart={visibleWindow.start} windowEnd={visibleWindow.end} historyLoading={history.historyLoading} observedCount={visibleObservedCount} modeledCount={visibleModeledCount} extendedHistory={history.extendedHistory} extendedHistoryMatches={history.matchesScope} needsExtendedHistory={needsExtendedHistory} historyCsvUrl={preferences.view === "history" ? history.csvUrl : null} historyError={history.historyError} />
            {history.historyError && needsExtendedHistory && <div role="alert" className="border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">{history.historyError}</div>}
            {history.extendedHistory?.partial && history.matchesScope && needsExtendedHistory && !history.historyError && <div role="status" className="border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">Pikema ajaloo osa allikaid ei vastanud; kuvatakse kõik kättesaadavad mõõtmised.</div>}
            <PeriodSummary points={summaryPoints} startValue={preferences.periodStart} endValue={preferences.periodEnd} onStartChange={preferences.setPeriodStart} onEndChange={preferences.setPeriodEnd} maximumValue={maximumPeriodInput} />
            <WeatherCharts points={chartPoints} visibleMetricIds={preferences.visibleMetricIds} onToggleMetric={preferences.toggleMetric} startMs={visibleWindow.start} endMs={visibleWindow.end} nowMs={nowMs} periodStartMs={periodStartMs} periodEndMs={periodEndInclusiveMs} pinnedInspectionMs={pinnedInspectionMs} previewInspectionMs={previewInspectionMs} onInspectionPreview={setPreviewInspectionMs} onInspectionPin={setPinnedInspectionMs} inspectionAnnouncement={inspectionAnnouncement} />
          </div>
        )}
        {!data && !feed.loading && !feed.error && <p className="border-y border-[#9fb2c0] px-3 py-4 text-xs text-[#526878] dark:border-[#35536a] dark:text-[#8da1b0]">Ilmaandmed pole saadaval.</p>}
        <WeatherRadarSection />
        {data && <WeatherSources data={data} />}
      </main>
      <WeatherFooter data={data} />
    </div>
  );
}
