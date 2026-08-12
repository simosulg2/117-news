"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { WeatherRadar } from "@/components/weather-radar";
import { nearestTimestamp, stepTimestamp, uniqueSortedTimestamps } from "@/lib/weather-chart";
import { resolveTallinnLocalTime, TALLINN_TIME_ZONE } from "@/lib/weather-time";
import type { WeatherHistoryResponse, WeatherPoint, WeatherResponse } from "@/lib/weather-types";

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const WEATHER_REFRESH_MS = 5 * 60 * 1_000;
const WEATHER_STALE_AFTER_MS = 20 * 60 * 1_000;
const CURRENT_OBSERVATION_STALE_AFTER_MS = 30 * 60 * 1_000;
const WEATHER_PREFERENCES_KEY = "117-weather-preferences";

const clockFormatter = new Intl.DateTimeFormat("et-EE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: TALLINN_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TALLINN_TIME_ZONE,
});

const shortTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TALLINN_TIME_ZONE,
});

const axisTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TALLINN_TIME_ZONE,
});

const dateInputFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TALLINN_TIME_ZONE,
});

const dateTimeInputFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TALLINN_TIME_ZONE,
});

const decimalFormatter = new Intl.NumberFormat("et-EE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

type WeatherView = "history" | "now" | "forecast";
type WeatherRange = "24h" | "3d" | "7d" | "30d" | "90d" | "date";
type MetricField =
  | "temperatureC"
  | "relativeHumidityPct"
  | "cloudCoverPct"
  | "precipitationMm"
  | "windSpeedMs"
  | "windGustMs"
  | "pressureHpa";

type MetricDefinition = {
  id: string;
  title: string;
  shortTitle: string;
  unit: string;
  field: MetricField;
  secondaryField?: MetricField;
  secondaryLabel?: string;
  color: string;
  secondaryColor?: string;
  fixedMin?: number;
  fixedMax?: number;
  bars?: boolean;
};

const METRICS: MetricDefinition[] = [
  {
    id: "temperature",
    title: "Õhutemperatuur",
    shortTitle: "Temperatuur",
    unit: "°C",
    field: "temperatureC",
    color: "#d9473f",
  },
  {
    id: "humidity",
    title: "Suhteline õhuniiskus",
    shortTitle: "Niiskus",
    unit: "%",
    field: "relativeHumidityPct",
    color: "#087663",
    fixedMin: 0,
    fixedMax: 100,
  },
  {
    id: "cloud",
    title: "Pilvisus",
    shortTitle: "Pilvisus",
    unit: "%",
    field: "cloudCoverPct",
    color: "#687c8a",
    fixedMin: 0,
    fixedMax: 100,
  },
  {
    id: "precipitation",
    title: "Sademed tunnis",
    shortTitle: "Sademed",
    unit: "mm",
    field: "precipitationMm",
    color: "#2268bd",
    fixedMin: 0,
    bars: true,
  },
  {
    id: "wind",
    title: "Tuul ja puhangud",
    shortTitle: "Tuul",
    unit: "m/s",
    field: "windSpeedMs",
    secondaryField: "windGustMs",
    secondaryLabel: "Puhang",
    color: "#6f56b3",
    secondaryColor: "#ce7b20",
    fixedMin: 0,
  },
  {
    id: "pressure",
    title: "Õhurõhk merepinnal",
    shortTitle: "Õhurõhk",
    unit: "hPa",
    field: "pressureHpa",
    color: "#18795d",
  },
];

const PHENOMENON_LABELS_ET: Readonly<Record<string, string>> = {
  clear: "Selge",
  "few clouds": "Vähene pilvisus",
  "variable clouds": "Poolpilves",
  "cloudy with clear spells": "Peamiselt pilves",
  overcast: "Pilves",
  "light snow shower": "Nõrk hooglumi",
  "moderate snow shower": "Mõõdukas hooglumi",
  "heavy snow shower": "Tugev hooglumi",
  "light shower": "Nõrk hoovihm",
  "moderate shower": "Mõõdukas hoovihm",
  "heavy shower": "Tugev hoovihm",
  "light rain": "Nõrk vihm",
  "moderate rain": "Mõõdukas vihm",
  "heavy rain": "Tugev vihm",
  glaze: "Jäide",
  "light sleet": "Nõrk lörtsisadu",
  "moderate sleet": "Mõõdukas lörtsisadu",
  "light snowfall": "Nõrk lumesadu",
  "moderate snowfall": "Mõõdukas lumesadu",
  "heavy snowfall": "Tugev lumesadu",
  hail: "Rahe",
  mist: "Uduvine",
  fog: "Udu",
};

function displayPhenomenon(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return PHENOMENON_LABELS_ET[trimmed.toLocaleLowerCase("en-US")] ?? trimmed;
}

function formatNumber(value: number | null | undefined, unit = "", digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const formatted = new Intl.NumberFormat("et-EE", { maximumFractionDigits: digits }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function fieldValue(point: WeatherPoint, field: MetricField): number | null {
  const value = point[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0);
}

function min(values: number[]): number | null {
  return values.length > 0 ? Math.min(...values) : null;
}

function max(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function toTallinnDateTimeInput(value: number): string {
  return dateTimeInputFormatter.format(new Date(value)).replace(" ", "T");
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function nextDate(value: string): string {
  return shiftDate(value, 1);
}

function rangeWindow(
  view: WeatherView,
  range: WeatherRange,
  selectedDate: string,
  selectedEndDate: string,
  nowMs: number,
): { start: number; end: number } {
  if (range === "date") {
    const startResult = resolveTallinnLocalTime(`${selectedDate}T00:00`);
    const start = startResult.status === "valid" ? startResult.timestamp : nowMs - DAY_MS;
    const requestedEndDate = view === "history" && selectedEndDate >= selectedDate ? selectedEndDate : selectedDate;
    const finalDate = view === "history"
      ? [requestedEndDate, shiftDate(selectedDate, 89), dateInputFormatter.format(new Date(nowMs))].sort()[0]
      : selectedDate;
    const endResult = resolveTallinnLocalTime(`${nextDate(finalDate)}T00:00`);
    const end = endResult.status === "valid" ? endResult.timestamp : start + DAY_MS;
    return { start, end: view === "history" ? Math.min(end, nowMs) : end };
  }

  const duration = range === "24h"
    ? DAY_MS
    : range === "3d"
      ? 3 * DAY_MS
      : range === "7d" || view !== "history"
        ? 7 * DAY_MS
        : range === "30d"
          ? 30 * DAY_MS
          : 90 * DAY_MS;
  if (view === "history") return { start: nowMs - duration, end: nowMs };
  if (view === "forecast") return { start: nowMs, end: nowMs + duration };
  return { start: nowMs - duration / 2, end: nowMs + duration / 2 };
}

function deduplicatePoints(points: WeatherPoint[]): WeatherPoint[] {
  const unique = new Map<string, WeatherPoint>();
  for (const point of points) {
    unique.set(`${point.kind}:${point.source}:${point.time}`, point);
  }
  return [...unique.values()].sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
}

function mode(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function sourceLabel(kind: WeatherPoint["kind"]): string {
  return kind === "observed" ? "Mõõdetud" : "Mudel";
}

function weatherSourceLabel(source: WeatherPoint["source"]): string {
  return source === "open_meteo" ? "Open-Meteo" : "Ilmateenistus";
}

type MetricSamples = {
  values: number[];
  kind: WeatherPoint["kind"] | null;
  observedCount: number;
  modeledCount: number;
};

function pointsForField(points: WeatherPoint[], field: MetricField): MetricSamples {
  const observed = points
    .filter((point) => point.kind === "observed")
    .map((point) => fieldValue(point, field))
    .filter((value): value is number => value !== null);
  const modeled = points
    .filter((point) => point.kind === "modeled")
    .map((point) => fieldValue(point, field))
    .filter((value): value is number => value !== null);
  if (observed.length > 0) {
    return {
      values: observed,
      kind: "observed",
      observedCount: observed.length,
      modeledCount: modeled.length,
    };
  }
  return {
    values: modeled,
    kind: modeled.length > 0 ? "modeled" : null,
    observedCount: 0,
    modeledCount: modeled.length,
  };
}

function sampleCoverage(samples: MetricSamples): string {
  const parts: string[] = [];
  if (samples.observedCount > 0) {
    parts.push(`${samples.observedCount} mõõdetud ${samples.observedCount === 1 ? "näidis" : "näidist"}`);
  }
  if (samples.modeledCount > 0) {
    parts.push(`${samples.modeledCount} mudelinäidis${samples.modeledCount === 1 ? "" : "t"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "näidised puuduvad";
}

function pathSegments(
  points: WeatherPoint[],
  kind: WeatherPoint["kind"],
  field: MetricField,
  xForTime: (value: number) => number,
  yForValue: (value: number) => number,
  maximumGapMs: number,
): string[] {
  const segments: string[] = [];
  let commands: string[] = [];
  let previousTime: number | null = null;

  const flush = () => {
    if (commands.length > 0) segments.push(commands.join(" "));
    commands = [];
    previousTime = null;
  };

  for (const point of points) {
    if (point.kind !== kind) continue;
    const time = Date.parse(point.time);
    const value = fieldValue(point, field);
    if (!Number.isFinite(time) || value === null) {
      flush();
      continue;
    }
    if (previousTime !== null && time - previousTime > maximumGapMs) flush();
    commands.push(`${commands.length === 0 ? "M" : "L"} ${xForTime(time).toFixed(2)} ${yForValue(value).toFixed(2)}`);
    previousTime = time;
  }
  flush();
  return segments;
}

function ChartLegendLine({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-7 border-t-2"
      style={{ borderColor: color, borderTopStyle: dashed ? "dashed" : "solid" }}
    />
  );
}

function ChartLegendBar({ color, modeled = false }: { color: string; modeled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-5 border"
      style={modeled
        ? {
            borderColor: color,
            backgroundImage: `repeating-linear-gradient(135deg, transparent 0 2px, ${color} 2px 4px)`,
          }
        : { borderColor: color, backgroundColor: color }}
    />
  );
}

type MetricChartProps = {
  metric: MetricDefinition;
  points: WeatherPoint[];
  startMs: number;
  endMs: number;
  nowMs: number;
  periodStartMs: number | null;
  periodEndMs: number | null;
  inspectionMs: number | null;
  inspectionPinned: boolean;
  onInspectionPreview: (value: number | null) => void;
  onInspectionPin: (value: number | null) => void;
};

function MetricChart({
  metric,
  points,
  startMs,
  endMs,
  nowMs,
  periodStartMs,
  periodEndMs,
  inspectionMs,
  inspectionPinned,
  onInspectionPreview,
  onInspectionPin,
}: MetricChartProps) {
  const titleId = useId();
  const interactionHintId = `${titleId}-interaction-hint`;
  const inspectionReadoutId = `${titleId}-inspection-readout`;
  const modeledBarPatternId = `${titleId.replace(/:/g, "")}-modeled-bars`;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const activeTouchPointerRef = useRef<number | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const [chartWidth, setChartWidth] = useState(720);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateWidth = (nextWidth: number) => {
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
      const roundedWidth = Math.max(280, Math.round(nextWidth));
      setChartWidth((current) => current === roundedWidth ? current : roundedWidth);
    };

    updateWidth(container.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => updateWidth(container.getBoundingClientRect().width);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) updateWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    onInspectionPreview(null);
  }, [onInspectionPreview]);

  const queueInspectionPreview = useCallback((value: number | null) => {
    if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      onInspectionPreview(value);
    });
  }, [onInspectionPreview]);

  const chartPoints = useMemo(
    () => points.filter((point) => {
      const time = Date.parse(point.time);
      return Number.isFinite(time) && time >= startMs && time <= endMs;
    }),
    [endMs, points, startMs],
  );
  const numericValues = chartPoints.flatMap((point) => {
    const primary = fieldValue(point, metric.field);
    const secondary = metric.secondaryField ? fieldValue(point, metric.secondaryField) : null;
    return [primary, secondary].filter((value): value is number => value !== null);
  });
  const hasObserved = chartPoints.some((point) => point.kind === "observed" && fieldValue(point, metric.field) !== null);
  const hasModeled = chartPoints.some((point) => point.kind === "modeled" && fieldValue(point, metric.field) !== null);
  const width = chartWidth;
  const height = 174;
  const padding = { top: 12, right: width < 480 ? 7 : 12, bottom: 34, left: width < 480 ? 43 : 50 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const rawMin = metric.fixedMin ?? min(numericValues) ?? 0;
  const rawMax = metric.fixedMax ?? max(numericValues) ?? 1;
  const dataSpan = Math.max(rawMax - rawMin, metric.id === "pressure" ? 2 : 1);
  const yMin = metric.fixedMin ?? rawMin - dataSpan * 0.12;
  const yMax = metric.fixedMax ?? rawMax + dataSpan * 0.12;
  const timeSpan = Math.max(endMs - startMs, 1);
  const xForTime = (value: number) => padding.left + ((value - startMs) / timeSpan) * plotWidth;
  const yForValue = (value: number) => padding.top + (1 - (value - yMin) / Math.max(yMax - yMin, 1)) * plotHeight;
  const maximumGapMs = timeSpan > 2 * DAY_MS ? 4 * HOUR_MS : 2 * HOUR_MS;
  const yTicks = [yMax, (yMin + yMax) / 2, yMin];
  const xTickFractions = width < 480 ? [0, 0.5, 1] : width < 680 ? [0, 1 / 3, 2 / 3, 1] : [0, 0.25, 0.5, 0.75, 1];
  const xTicks = xTickFractions.map((portion) => startMs + timeSpan * portion);
  const observedPaths = pathSegments(chartPoints, "observed", metric.field, xForTime, yForValue, maximumGapMs);
  const modeledPaths = pathSegments(chartPoints, "modeled", metric.field, xForTime, yForValue, maximumGapMs);
  const observedSecondaryPaths = metric.secondaryField
    ? pathSegments(chartPoints, "observed", metric.secondaryField, xForTime, yForValue, maximumGapMs)
    : [];
  const modeledSecondaryPaths = metric.secondaryField
    ? pathSegments(chartPoints, "modeled", metric.secondaryField, xForTime, yForValue, maximumGapMs)
    : [];
  const timesWithBothKinds = useMemo(() => {
    const kindsByTime = new Map<string, Set<WeatherPoint["kind"]>>();
    for (const point of chartPoints) {
      if (fieldValue(point, metric.field) === null) continue;
      const kinds = kindsByTime.get(point.time) ?? new Set<WeatherPoint["kind"]>();
      kinds.add(point.kind);
      kindsByTime.set(point.time, kinds);
    }
    return new Set(
      [...kindsByTime.entries()].filter(([, kinds]) => kinds.size > 1).map(([time]) => time),
    );
  }, [chartPoints, metric.field]);
  const selectedStart = periodStartMs === null ? null : Math.max(startMs, periodStartMs);
  const selectedEnd = periodEndMs === null ? null : Math.min(endMs, periodEndMs);
  const selectableTimestamps = useMemo(
    () => uniqueSortedTimestamps(
      chartPoints
        .filter((point) => (
          fieldValue(point, metric.field) !== null
          || (metric.secondaryField ? fieldValue(point, metric.secondaryField) !== null : false)
        ))
        .map((point) => Date.parse(point.time)),
    ),
    [chartPoints, metric.field, metric.secondaryField],
  );
  const typicalSelectableGap = useMemo(() => {
    const gaps = selectableTimestamps.slice(1).map((value, index) => value - selectableTimestamps[index]);
    return gaps.length > 0
      ? [...gaps].sort((left, right) => left - right)[Math.floor(gaps.length / 2)]
      : timeSpan;
  }, [selectableTimestamps, timeSpan]);
  const inspectedPoints = inspectionMs === null
    ? []
    : chartPoints.filter((point) => (
        Date.parse(point.time) === inspectionMs
        && (fieldValue(point, metric.field) !== null
          || (metric.secondaryField ? fieldValue(point, metric.secondaryField) !== null : false))
      ));
  const inspectionInRange = inspectionMs !== null && inspectionMs >= startMs && inspectionMs <= endMs;
  const inspectionLabel = inspectionInRange
    ? dateTimeFormatter.format(new Date(inspectionMs))
    : null;
  const inspectionValueText = inspectionLabel
    ? `${inspectionLabel}; ${inspectedPoints.map((point) => (
        `${sourceLabel(point.kind)} ${formatNumber(fieldValue(point, metric.field), metric.unit)}`
        + `${metric.secondaryField && fieldValue(point, metric.secondaryField) !== null
          ? `; ${metric.secondaryLabel} ${formatNumber(fieldValue(point, metric.secondaryField), metric.unit)}`
          : ""} ${weatherSourceLabel(point.source)}`
      )).join("; ") || "väärtus puudub"}`
    : "Aeg pole valitud";

  const timestampForClientX = useCallback((clientX: number): number | null => {
    const container = chartContainerRef.current;
    if (!container || selectableTimestamps.length === 0) return null;
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0) return null;
    const viewX = ((clientX - bounds.left) / bounds.width) * width;
    const plotPortion = Math.max(0, Math.min(1, (viewX - padding.left) / Math.max(plotWidth, 1)));
    const target = startMs + plotPortion * timeSpan;
    return nearestTimestamp(selectableTimestamps, target, Math.max(typicalSelectableGap * 2, 30 * 60_000));
  }, [padding.left, plotWidth, selectableTimestamps, startMs, timeSpan, typicalSelectableGap, width]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null | undefined;
    if (event.key === "ArrowLeft") next = stepTimestamp(selectableTimestamps, inspectionMs, "previous");
    else if (event.key === "ArrowRight") next = stepTimestamp(selectableTimestamps, inspectionMs, "next");
    else if (event.key === "Home") next = stepTimestamp(selectableTimestamps, inspectionMs, "first");
    else if (event.key === "End") next = stepTimestamp(selectableTimestamps, inspectionMs, "last");
    else if (event.key === "Escape") next = null;
    else return;
    event.preventDefault();
    onInspectionPreview(null);
    onInspectionPin(next);
  }, [inspectionMs, onInspectionPin, onInspectionPreview, selectableTimestamps]);

  const tablePoints = chartPoints
    .filter((point) => fieldValue(point, metric.field) !== null || (metric.secondaryField && fieldValue(point, metric.secondaryField) !== null))
    .slice(-240);

  return (
    <article className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#bdcad3] px-3 py-2 dark:border-[#294154]">
        <div>
          <h3 id={titleId} className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">
            {metric.title}
          </h3>
          <p className="mt-0.5 text-[11px] text-[#5b6f7d] dark:text-[#8da1b0]">Ühik: {metric.unit}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#526878] dark:text-[#9aabb7]">
          {hasObserved && (
            <span className="inline-flex items-center gap-1.5">
              {metric.bars ? <ChartLegendBar color={metric.color} /> : <ChartLegendLine color={metric.color} />} Mõõdetud
            </span>
          )}
          {hasModeled && (
            <span className="inline-flex items-center gap-1.5">
              {metric.bars ? <ChartLegendBar color={metric.color} modeled /> : <ChartLegendLine color={metric.color} dashed />} Mudel
            </span>
          )}
          {metric.secondaryField && (
            <span className="inline-flex items-center gap-1.5">
              <ChartLegendLine color={metric.secondaryColor ?? metric.color} dashed /> {metric.secondaryLabel}
            </span>
          )}
        </div>
      </div>

      {numericValues.length === 0 ? (
        <div className="flex h-44 items-center justify-center px-4 text-center text-xs text-[#526878] dark:text-[#8da1b0]">
          Selle näitaja andmeid valitud ajavahemikus ei ole.
        </div>
      ) : (
        <div
          ref={chartContainerRef}
          role="slider"
          tabIndex={0}
          aria-label={`${metric.title}: täpse aja valik`}
          aria-describedby={`${interactionHintId} ${inspectionReadoutId}`}
          aria-valuemin={selectableTimestamps[0]}
          aria-valuemax={selectableTimestamps[selectableTimestamps.length - 1]}
          aria-valuenow={inspectionInRange
            ? Math.max(selectableTimestamps[0], Math.min(selectableTimestamps.at(-1)!, inspectionMs))
            : selectableTimestamps[0]}
          aria-valuetext={inspectionValueText}
          onKeyDown={handleKeyDown}
          onPointerMove={(event) => {
            const value = timestampForClientX(event.clientX);
            if (event.pointerType === "mouse") queueInspectionPreview(value);
            else if (activeTouchPointerRef.current === event.pointerId) onInspectionPin(value);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") queueInspectionPreview(null);
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") return;
            activeTouchPointerRef.current = event.pointerId;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            onInspectionPreview(null);
            onInspectionPin(timestampForClientX(event.clientX));
          }}
          onPointerUp={(event) => {
            if (activeTouchPointerRef.current === event.pointerId) activeTouchPointerRef.current = null;
          }}
          onPointerCancel={(event) => {
            if (activeTouchPointerRef.current === event.pointerId) activeTouchPointerRef.current = null;
          }}
          onClick={(event) => {
            if (event.detail === 0) return;
            onInspectionPreview(null);
            onInspectionPin(timestampForClientX(event.clientX));
          }}
          className="overflow-hidden px-1 pb-1 pt-2 text-[#738795] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#7890a2]"
          style={{ touchAction: "pan-y" }}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-labelledby={titleId}
            className="block h-[10.875rem] w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <desc>
              {metric.title} ajavahemikus {dateTimeFormatter.format(new Date(startMs))} kuni {dateTimeFormatter.format(new Date(endMs))}.
              Pidev joon või täistulp tähistab mõõtmisi; katkendjoon või viirutatud tulp mudelandmeid.
            </desc>
            {metric.bars && (
              <defs>
                <pattern id={modeledBarPatternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
                  <line x1="0" y1="0" x2="0" y2="6" stroke={metric.color} strokeWidth="2" />
                </pattern>
              </defs>
            )}
            {selectedStart !== null && selectedEnd !== null && selectedEnd > selectedStart && (
              <rect
                x={xForTime(selectedStart)}
                y={padding.top}
                width={Math.max(0, xForTime(selectedEnd) - xForTime(selectedStart))}
                height={plotHeight}
                fill="#4f8cff"
                opacity="0.09"
              />
            )}
            {yTicks.map((tick, index) => {
              const y = yForValue(tick);
              return (
                <g key={`${metric.id}-y-${index}`}>
                  <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" opacity="0.22" />
                  <text x={padding.left - 7} y={y + 4} textAnchor="end" fill="currentColor" fontSize="10">
                    {decimalFormatter.format(tick)}
                  </text>
                </g>
              );
            })}
            {xTicks.map((tick, index) => {
              const x = xForTime(tick);
              return (
                <g key={`${metric.id}-x-${index}`}>
                  <line x1={x} x2={x} y1={padding.top} y2={height - padding.bottom} stroke="currentColor" opacity="0.11" />
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}
                    fill="currentColor"
                    fontSize="10"
                  >
                    {axisTimeFormatter.format(new Date(tick)).replace(",", "")}
                  </text>
                </g>
              );
            })}

            {metric.bars
              ? chartPoints.map((point, index) => {
                  const value = fieldValue(point, metric.field);
                  if (value === null) return null;
                  const x = xForTime(Date.parse(point.time));
                  const barWidth = Math.max(1, Math.min(8, plotWidth / Math.max(chartPoints.length, 1) - 0.5));
                  const hasOtherKindAtTime = timesWithBothKinds.has(point.time);
                  const renderedWidth = hasOtherKindAtTime ? Math.max(1, barWidth * 0.62) : barWidth;
                  const xOffset = hasOtherKindAtTime
                    ? (point.kind === "observed" ? -barWidth * 0.22 : barWidth * 0.22)
                    : 0;
                  const zeroY = yForValue(Math.max(0, yMin));
                  const valueY = yForValue(value);
                  return (
                    <rect
                      key={`${point.kind}-${point.time}-${index}`}
                      x={x + xOffset - renderedWidth / 2}
                      y={Math.min(zeroY, valueY)}
                      width={renderedWidth}
                      height={Math.max(1, Math.abs(zeroY - valueY))}
                      fill={point.kind === "observed" ? metric.color : `url(#${modeledBarPatternId})`}
                      stroke={metric.color}
                      strokeWidth={point.kind === "observed" ? 0 : 0.8}
                    />
                  );
                })
              : null}

            {!metric.bars && observedPaths.map((path, index) => (
              <path key={`observed-${index}`} d={path} fill="none" stroke={metric.color} strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
            ))}
            {!metric.bars && modeledPaths.map((path, index) => (
              <path
                key={`modeled-${index}`}
                d={path}
                fill="none"
                stroke={metric.color}
                strokeWidth="2.25"
                strokeDasharray="7 5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {observedSecondaryPaths.map((path, index) => (
              <path
                key={`observed-secondary-${index}`}
                d={path}
                fill="none"
                stroke={metric.secondaryColor ?? metric.color}
                strokeWidth="1.8"
                strokeDasharray="2 3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {modeledSecondaryPaths.map((path, index) => (
              <path
                key={`modeled-secondary-${index}`}
                d={path}
                fill="none"
                stroke={metric.secondaryColor ?? metric.color}
                strokeWidth="1.8"
                strokeDasharray="8 4 2 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {nowMs >= startMs && nowMs <= endMs && (
              <g>
                <line
                  x1={xForTime(nowMs)}
                  x2={xForTime(nowMs)}
                  y1={padding.top}
                  y2={height - padding.bottom}
                  stroke="#4f8cff"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                <text x={xForTime(nowMs) + 4} y={padding.top + 10} fill="#245fae" fontSize="10" fontWeight="700">
                  PRAEGU
                </text>
              </g>
            )}
            {inspectionInRange && (
              <g aria-hidden="true">
                <line
                  x1={xForTime(inspectionMs)}
                  x2={xForTime(inspectionMs)}
                  y1={padding.top}
                  y2={height - padding.bottom}
                  stroke="#d68b20"
                  strokeWidth="1.75"
                  vectorEffect="non-scaling-stroke"
                />
                {inspectedPoints.map((point, index) => {
                  const value = fieldValue(point, metric.field);
                  if (value === null) return null;
                  return (
                    <circle
                      key={`${point.kind}-${point.source}-${index}`}
                      cx={xForTime(inspectionMs)}
                      cy={yForValue(value)}
                      r="3.5"
                      fill={point.kind === "observed" ? metric.color : "#f4f7f9"}
                      stroke={metric.color}
                      strokeWidth="1.75"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
              </g>
            )}
          </svg>
        </div>
      )}

      {numericValues.length > 0 && (
        <div
          id={inspectionReadoutId}
          className="border-t border-[#bdcad3] bg-white/50 px-3 py-2 text-[11px] leading-5 text-[#456070] dark:border-[#294154] dark:bg-[#07131f]/40 dark:text-[#9aabb7]"
        >
          {inspectionLabel ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <time className="font-bold tabular-nums text-[#805818] dark:text-[#efb860]">
                {inspectionLabel} Eesti aeg{inspectionPinned ? " · kinnitatud" : ""}
              </time>
              {inspectedPoints.length > 0 ? inspectedPoints.map((point, index) => (
                <span key={`${point.kind}-${point.source}-${index}`}>
                  <b className={point.kind === "observed" ? "text-[#087663] dark:text-[#55d6b2]" : "text-[#60459f] dark:text-[#c7b8ff]"}>
                    {sourceLabel(point.kind)}
                  </b>
                  {` · ${formatNumber(fieldValue(point, metric.field), metric.unit)}`}
                  {metric.secondaryField && fieldValue(point, metric.secondaryField) !== null
                    ? ` · ${metric.secondaryLabel} ${formatNumber(fieldValue(point, metric.secondaryField), metric.unit)}`
                    : ""}
                  {` · ${weatherSourceLabel(point.source)}`}
                </span>
              )) : <span>Selle näitaja väärtus sel ajal puudub.</span>}
            </div>
          ) : (
            <span id={interactionHintId}>Täpsete väärtuste vaatamiseks liiguta kursorit graafikul või puuduta seda. Nooleklahvid liiguvad ajapunktide vahel.</span>
          )}
          {inspectionLabel && <span id={interactionHintId} className="sr-only">Nooleklahvid liiguvad ajapunktide vahel. Escape eemaldab valiku.</span>}
        </div>
      )}

      {numericValues.length > 0 && (
        <details className="border-t border-[#bdcad3] text-xs dark:border-[#294154]">
          <summary className="cursor-pointer px-3 py-2 font-semibold text-[#456070] outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#9aabb7] dark:hover:text-[#7db0ff]">
            Ava ligipääsetav andmetabel
          </summary>
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
                    {metric.secondaryField && (
                      <td className="px-3 py-1.5">{formatNumber(fieldValue(point, metric.secondaryField), metric.unit)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {tablePoints.length < chartPoints.length && (
              <p className="px-3 py-2 text-[11px] text-[#5b6f7d] dark:text-[#8da1b0]">Tabelis on 240 viimast punkti. Pikema ajaloo kõik algandmed saab laadida CSV-failina.</p>
            )}
          </div>
        </details>
      )}
    </article>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function WeatherLoadingState() {
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

function CurrentConditions({ data, stale }: { data: WeatherResponse; stale: boolean }) {
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
          <span
            className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
              point.kind === "observed"
                ? "border-[#29806c] bg-[#087663]/10 text-[#087663] dark:text-[#55d6b2]"
                : "border-[#7964bd] bg-[#6f56b3]/10 text-[#60459f] dark:text-[#c7b8ff]"
            }`}
          >
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
        <CurrentMetric
          label="Temperatuur"
          value={formatNumber(point.temperatureC, "°C")}
          detail={point.apparentTemperatureC === null ? undefined : `tajutav ${formatNumber(point.apparentTemperatureC, "°C")}`}
        />
        <CurrentMetric label="Ilm / pilvisus" value={cloudDescription} detail={point.cloudCoverPct === null ? undefined : formatNumber(point.cloudCoverPct, "%", 0)} />
        <CurrentMetric label="Õhuniiskus" value={formatNumber(point.relativeHumidityPct, "%", 0)} />
        <CurrentMetric label="Tuul" value={formatNumber(point.windSpeedMs, "m/s")} detail={windDetail} />
        <CurrentMetric label="Sademed" value={formatNumber(point.precipitationMm, "mm")} detail="viimase tunni sademed" />
        <CurrentMetric label="Õhurõhk" value={formatNumber(point.pressureHpa, "hPa")} />
      </dl>
    </section>
  );
}

type PeriodSummaryProps = {
  points: WeatherPoint[];
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  maximumValue: string;
};

function PeriodSummary({ points, startValue, endValue, onStartChange, onEndChange, maximumValue }: PeriodSummaryProps) {
  const startResult = resolveTallinnLocalTime(startValue);
  const endResult = resolveTallinnLocalTime(endValue);
  const startMs = startResult.status === "valid" ? startResult.timestamp : null;
  const endMs = endResult.status === "valid" ? endResult.timestamp : null;
  const hasNonexistentTime = startResult.status === "nonexistent" || endResult.status === "nonexistent";
  const hasAmbiguousTime = (startResult.status === "valid" && startResult.ambiguous)
    || (endResult.status === "valid" && endResult.ambiguous);
  const valid = startMs !== null && endMs !== null && startMs < endMs;
  const inclusiveEndMs = endMs === null ? null : endMs + 60_000 - 1;
  const selectedPoints = valid
    ? points.filter((point) => {
        const time = Date.parse(point.time);
        return Number.isFinite(time) && time >= startMs && inclusiveEndMs !== null && time <= inclusiveEndMs;
      })
    : [];
  const temperature = pointsForField(selectedPoints, "temperatureC");
  const humidity = pointsForField(selectedPoints, "relativeHumidityPct");
  const precipitation = pointsForField(selectedPoints, "precipitationMm");
  const wind = pointsForField(selectedPoints, "windSpeedMs");
  const gust = pointsForField(selectedPoints, "windGustMs");
  const cloud = pointsForField(selectedPoints, "cloudCoverPct");
  const pressure = pointsForField(selectedPoints, "pressureHpa");
  const phenomenonSamples = selectedPoints
    .filter((point) => point.kind === "observed" && Boolean(point.phenomenon?.trim()))
    .map((point) => point.phenomenon!.trim());
  const phenomenonRaw = mode(phenomenonSamples);
  const phenomenon = displayPhenomenon(phenomenonRaw);
  const observedCount = new Set(selectedPoints.filter((point) => point.kind === "observed").map((point) => point.time)).size;
  const modeledCount = new Set(selectedPoints.filter((point) => point.kind === "modeled").map((point) => point.time)).size;
  const intervalMinutes = valid && startMs !== null && endMs !== null
    ? Math.max(1, Math.round((endMs - startMs) / 60_000))
    : null;
  const summaries = [
    {
      label: "Temperatuur",
      value:
        temperature.values.length > 0
          ? `${formatNumber(min(temperature.values), "°C")} / ${formatNumber(average(temperature.values), "°C")} / ${formatNumber(max(temperature.values), "°C")}`
          : "—",
      detail: "näidiste min / keskmine / max",
      kind: temperature.kind,
      coverage: sampleCoverage(temperature),
    },
    {
      label: "Õhuniiskus",
      value: formatNumber(average(humidity.values), "%", 0),
      detail: "näidiste keskmine",
      kind: humidity.kind,
      coverage: sampleCoverage(humidity),
    },
    {
      label: "Sademed",
      value: formatNumber(sum(precipitation.values), "mm"),
      detail: "valitud näidiste summa",
      kind: precipitation.kind,
      coverage: sampleCoverage(precipitation),
    },
    {
      label: "Tuul",
      value: formatNumber(average(wind.values), "m/s"),
      detail: `näidiste keskmine · puhang max ${formatNumber(max(gust.values), "m/s")}`,
      kind: wind.kind ?? gust.kind,
      coverage: `${sampleCoverage(wind)} · puhang: ${sampleCoverage(gust)}`,
    },
    {
      label: "Pilvisus",
      value: phenomenon ?? formatNumber(average(cloud.values), "%", 0),
      detail:
        phenomenon && cloud.values.length > 0
          ? `${cloud.kind ? sourceLabel(cloud.kind).toLocaleLowerCase("et-EE") : "andmed"} ${formatNumber(average(cloud.values), "%", 0)}`
          : "keskmine",
      kind: phenomenon ? "observed" as const : cloud.kind,
      coverage: phenomenon
        ? `${phenomenonSamples.length} mõõdetud nähtusenäidis${phenomenonSamples.length === 1 ? "" : "t"}${cloud.modeledCount > 0 ? ` · ${cloud.modeledCount} mudelinäidist` : ""}`
        : sampleCoverage(cloud),
    },
    {
      label: "Õhurõhk",
      value: formatNumber(average(pressure.values), "hPa"),
      detail: "näidiste keskmine",
      kind: pressure.kind,
      coverage: sampleCoverage(pressure),
    },
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
            <input
              type="datetime-local"
              value={startValue}
              max={maximumValue}
              step={60}
              aria-describedby="period-timezone-note"
              onChange={(event) => onStartChange(event.target.value)}
              className="mt-1 block min-h-10 w-full border border-[#90a4b2] bg-white px-2 text-xs tabular-nums text-[#15232d] outline-none focus:border-signal focus:ring-1 focus:ring-signal dark:border-[#3b5870] dark:bg-[#07131f] dark:text-[#e5eef4]"
            />
          </label>
          <label className="text-[11px] font-bold text-[#456070] dark:text-[#9aabb7]">
            Lõpp
            <input
              type="datetime-local"
              value={endValue}
              max={maximumValue}
              step={60}
              aria-describedby="period-timezone-note"
              onChange={(event) => onEndChange(event.target.value)}
              className="mt-1 block min-h-10 w-full border border-[#90a4b2] bg-white px-2 text-xs tabular-nums text-[#15232d] outline-none focus:border-signal focus:ring-1 focus:ring-signal dark:border-[#3b5870] dark:bg-[#07131f] dark:text-[#e5eef4]"
            />
          </label>
        </div>
      </div>

      <p id="period-timezone-note" className="border-b border-[#d0dbe2] px-3 py-2 text-[10px] leading-4 text-[#5b6f7d] dark:border-[#24394a] dark:text-[#8da1b0]">
        Kellaajad on Eesti ajas. Mõõtmisi eelistatakse; puuduva näitaja juures kasutatakse ainult selgelt märgitud mudelandmeid.
      </p>

      {hasAmbiguousTime && (
        <p role="status" className="border-b border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
          Valitud kellaaeg kordub sügisesel kellakeeramisel. Kokkuvõttes kasutatakse selle kellaaja esimest esinemist.
        </p>
      )}

      {!startValue || !endValue ? (
        <p className="px-3 py-4 text-xs text-[#526878] dark:text-[#8da1b0]">
          Vali ajavahemiku algus ja lõpp.
        </p>
      ) : hasNonexistentTime ? (
        <p role="alert" className="px-3 py-4 text-xs font-semibold text-[#9d2f2f] dark:text-[#ff6b63]">
          Valitud kellaaega ei eksisteeri Eesti ajavööndis kevadise kellakeeramise tõttu. Vali teine kellaaeg.
        </p>
      ) : !valid ? (
        <p role="alert" className="px-3 py-4 text-xs font-semibold text-[#9d2f2f] dark:text-[#ff6b63]">
          Vali korrektne ajavahemik: lõpp peab olema algusest hilisem.
        </p>
      ) : points.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[#526878] dark:text-[#8da1b0]">
          Ajavahemiku kokkuvõtte jaoks pole ajalooandmed praegu saadaval.
        </p>
      ) : selectedPoints.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[#526878] dark:text-[#8da1b0]">
          Selle ajavahemiku kohta ei leitud mõõte- ega mudelandmeid.
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-6">
            {summaries.map((summary) => (
              <div key={summary.label} className="border-b border-r border-[#d0dbe2] px-3 py-3 last:border-r-0 dark:border-[#24394a] xl:border-b-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#5b6f7d] dark:text-[#8da1b0]">{summary.label}</h3>
                  {summary.kind && (
                    <span
                      className={`text-[9px] font-bold uppercase ${
                        summary.kind === "observed" ? "text-[#087663] dark:text-[#55d6b2]" : "text-[#60459f] dark:text-[#c7b8ff]"
                      }`}
                    >
                      {sourceLabel(summary.kind)}
                    </span>
                  )}
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

export function WeatherPortal() {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [extendedHistory, setExtendedHistory] = useState<WeatherHistoryResponse | null>(null);
  const [extendedHistoryScope, setExtendedHistoryScope] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [view, setView] = useState<WeatherView>("now");
  const [range, setRange] = useState<WeatherRange>("24h");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedEndDate, setSelectedEndDate] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [pinnedInspectionMs, setPinnedInspectionMs] = useState<number | null>(null);
  const [previewInspectionMs, setPreviewInspectionMs] = useState<number | null>(null);
  const [visibleMetricIds, setVisibleMetricIds] = useState(() => METRICS.map((metric) => metric.id));
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [now, setNow] = useState<Date | null>(null);
  const dataRef = useRef<WeatherResponse | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    let restoredSelectedDate = false;
    let restoredSelectedEndDate = false;
    let restoredSelectedDateValue: string | null = null;
    try {
      const raw = localStorage.getItem(WEATHER_PREFERENCES_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        if (saved.view === "history" || saved.view === "now" || saved.view === "forecast") setView(saved.view);
        if (
          saved.range === "24h"
          || saved.range === "3d"
          || saved.range === "7d"
          || saved.range === "30d"
          || saved.range === "90d"
          || saved.range === "date"
        ) setRange(saved.range);
        if (typeof saved.selectedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.selectedDate)) {
          setSelectedDate(saved.selectedDate);
          restoredSelectedDate = true;
          restoredSelectedDateValue = saved.selectedDate;
        }
        if (typeof saved.selectedEndDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(saved.selectedEndDate)) {
          setSelectedEndDate(saved.selectedEndDate);
          restoredSelectedEndDate = true;
        }
        const savedPeriodStart = typeof saved.periodStart === "string" ? saved.periodStart : saved.runStart;
        const savedPeriodEnd = typeof saved.periodEnd === "string" ? saved.periodEnd : saved.runEnd;
        if (typeof savedPeriodStart === "string") setPeriodStart(savedPeriodStart);
        if (typeof savedPeriodEnd === "string") setPeriodEnd(savedPeriodEnd);
        if (Array.isArray(saved.visibleMetricIds)) {
          const validIds = saved.visibleMetricIds.filter(
            (id): id is string => typeof id === "string" && METRICS.some((metric) => metric.id === id),
          );
          if (validIds.length > 0) setVisibleMetricIds([...new Set(validIds)]);
        }
      }
    } catch {
      // Defaults remain usable if preferences are corrupt or storage is blocked.
    } finally {
      const today = dateInputFormatter.format(new Date());
      if (!restoredSelectedDate) setSelectedDate(today);
      if (!restoredSelectedEndDate) setSelectedEndDate(restoredSelectedDateValue ?? today);
      setPreferencesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      localStorage.setItem(
        WEATHER_PREFERENCES_KEY,
        JSON.stringify({ view, range, selectedDate, selectedEndDate, periodStart, periodEnd, visibleMetricIds }),
      );
    } catch {
      // Weather controls remain usable for the current visit without storage.
    }
  }, [periodEnd, periodStart, preferencesLoaded, range, selectedDate, selectedEndDate, view, visibleMetricIds]);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let activeController: AbortController | null = null;

    async function loadWeather() {
      if (inFlight) return;
      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      if (dataRef.current) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch("/api/weather", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`weather endpoint returned ${response.status}`);
        const nextData = (await response.json()) as WeatherResponse;
        if (disposed) return;
        dataRef.current = nextData;
        setData(nextData);
        setError(null);
        setRefreshError(null);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (disposed) return;
        if (dataRef.current) {
          setRefreshError("Ilmaandmete taustvärskendus ebaõnnestus. Kuvame viimati edukalt laaditud andmeid.");
        } else {
          setError("Võru ilmaandmetega ei saadud ühendust. Radar võib sellest hoolimata töötada.");
        }
      } finally {
        if (activeController === controller) activeController = null;
        inFlight = false;
        if (!disposed && !controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void loadWeather();
    const refreshInterval = window.setInterval(() => void loadWeather(), WEATHER_REFRESH_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      const generatedAt = dataRef.current ? Date.parse(dataRef.current.generatedAt) : Number.NaN;
      if (!Number.isFinite(generatedAt) || Date.now() - generatedAt >= WEATHER_REFRESH_MS) {
        void loadWeather();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      disposed = true;
      activeController?.abort();
      window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [retryKey]);

  const allPoints = useMemo(() => {
    if (!data) return [];
    return deduplicatePoints([
      ...data.history.observed,
      ...data.history.modeled,
      ...data.forecast,
      ...(data.current ? [data.current] : []),
    ]);
  }, [data]);

  const historyPoints = useMemo(() => {
    if (!data) return [];
    return deduplicatePoints([
      ...data.history.observed,
      ...data.history.modeled,
      ...(data.current?.kind === "observed" ? [data.current] : []),
    ]);
  }, [data]);

  useEffect(() => {
    if (periodStart || periodEnd || historyPoints.length === 0) return;
    const observations = historyPoints.filter((point) => point.kind === "observed");
    const fallback = historyPoints.filter((point) => point.kind === "modeled");
    const candidates = observations.length > 0 ? observations : fallback;
    const latestSelectableMinute = Math.ceil(Date.now() / 60_000) * 60_000;
    const latestSelectablePoint = latestSelectableMinute + 60_000 - 1;
    const latest = Math.max(
      ...candidates
        .map((point) => Date.parse(point.time))
        .filter((time) => Number.isFinite(time) && time <= latestSelectablePoint),
    );
    if (!Number.isFinite(latest)) return;
    setPeriodStart(toTallinnDateTimeInput(latest - HOUR_MS));
    setPeriodEnd(toTallinnDateTimeInput(latest));
  }, [historyPoints, periodEnd, periodStart]);

  const nowMs = now?.getTime() ?? Date.now();
  const visibleWindow = useMemo(
    () => rangeWindow(view, range, selectedDate, selectedEndDate, nowMs),
    [nowMs, range, selectedDate, selectedEndDate, view],
  );
  const needsExtendedHistory = view === "history" && (range === "30d" || range === "90d" || range === "date");
  const extendedRequestStartMs = Math.floor(visibleWindow.start / WEATHER_REFRESH_MS) * WEATHER_REFRESH_MS;
  const extendedRequestEndMs = Math.floor(
    Math.min(visibleWindow.end, nowMs) / WEATHER_REFRESH_MS,
  ) * WEATHER_REFRESH_MS;
  const currentExtendedHistoryScope = `${range}:${selectedDate}:${selectedEndDate}`;
  const extendedHistoryMatchesScope = extendedHistory !== null
    && extendedHistoryScope === currentExtendedHistoryScope;

  useEffect(() => {
    if (!needsExtendedHistory) {
      setHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    const controller = new AbortController();
    const parameters = new URLSearchParams({
      from: new Date(extendedRequestStartMs).toISOString(),
      to: new Date(extendedRequestEndMs).toISOString(),
    });
    setHistoryLoading(true);
    setHistoryError(null);

    void fetch(`/api/weather/history?${parameters.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw new Error(`history endpoint returned ${response.status}`);
      const payload = (await response.json()) as WeatherHistoryResponse;
      if (controller.signal.aborted) return;
      setExtendedHistory(payload);
      setExtendedHistoryScope(currentExtendedHistoryScope);
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setHistoryError("Pikema ilmaajaloo laadimine ebaõnnestus. Lühemad vaated töötavad endiselt.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setHistoryLoading(false);
    });

    return () => controller.abort();
  }, [currentExtendedHistoryScope, extendedRequestEndMs, extendedRequestStartMs, needsExtendedHistory]);

  const chartPoints = useMemo(() => {
    if (!data) return [];
    if (view === "history") {
      if (needsExtendedHistory) {
        return deduplicatePoints(extendedHistoryMatchesScope ? extendedHistory.points : []);
      }
      return deduplicatePoints([
        ...data.history.observed,
        ...data.history.modeled,
        ...(data.current?.kind === "observed" ? [data.current] : []),
      ]);
    }
    if (view === "forecast") return deduplicatePoints(data.forecast);
    return allPoints;
  }, [allPoints, data, extendedHistory, extendedHistoryMatchesScope, needsExtendedHistory, view]);
  const visiblePoints = useMemo(
    () => chartPoints.filter((point) => {
      const time = Date.parse(point.time);
      return Number.isFinite(time) && time >= visibleWindow.start && time <= visibleWindow.end;
    }),
    [chartPoints, visibleWindow.end, visibleWindow.start],
  );
  const visibleObservedCount = new Set(visiblePoints.filter((point) => point.kind === "observed").map((point) => point.time)).size;
  const visibleModeledCount = new Set(visiblePoints.filter((point) => point.kind === "modeled").map((point) => point.time)).size;
  const periodStartResult = resolveTallinnLocalTime(periodStart);
  const periodEndResult = resolveTallinnLocalTime(periodEnd);
  const periodStartMs = periodStartResult.status === "valid" ? periodStartResult.timestamp : null;
  const periodEndMs = periodEndResult.status === "valid" ? periodEndResult.timestamp : null;
  const periodEndInclusiveMs = periodEndMs === null ? null : periodEndMs + 60_000 - 1;
  const maximumPeriodInput = toTallinnDateTimeInput(Math.ceil(nowMs / 60_000) * 60_000);
  const todayInput = dateInputFormatter.format(new Date(nowMs));
  const maximumCustomEndDate = selectedDate
    ? [shiftDate(selectedDate, 89), todayInput].sort()[0]
    : todayInput;
  const inspectionMs = previewInspectionMs ?? pinnedInspectionMs;
  const failedSources = data?.sources.filter((source) => source.status === "error") ?? [];
  const workingSourceCount = data?.sources.filter((source) => source.status === "ok").length ?? 0;
  const generatedAtMs = data ? Date.parse(data.generatedAt) : Number.NaN;
  const currentObservationMs = data?.current ? Date.parse(data.current.time) : Number.NaN;
  const weatherIsStale = Boolean(data) && (
    !Number.isFinite(generatedAtMs)
    || nowMs - generatedAtMs > WEATHER_STALE_AFTER_MS
    || (Number.isFinite(currentObservationMs) && nowMs - currentObservationMs > CURRENT_OBSERVATION_STALE_AFTER_MS)
  );

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("117-theme", next);
      } catch {
        // The in-page toggle still works when browser storage is unavailable.
      }
      return next;
    });
  }, []);

  const toggleMetric = useCallback((id: string) => {
    setVisibleMetricIds((current) => {
      if (current.includes(id)) return current.length === 1 ? current : current.filter((item) => item !== id);
      return METRICS.filter((metric) => current.includes(metric.id) || metric.id === id).map((metric) => metric.id);
    });
  }, []);

  const historyCsvUrl = view === "history"
    ? `/api/weather/history?${new URLSearchParams({
        from: new Date(extendedRequestStartMs).toISOString(),
        to: new Date(extendedRequestEndMs).toISOString(),
        format: "csv",
      }).toString()}`
    : null;
  const inspectionAnnouncement = pinnedInspectionMs === null
    ? null
    : `${dateTimeFormatter.format(new Date(pinnedInspectionMs))} Eesti aeg`;

  return (
    <div className="min-h-screen">
      <a
        href="#weather-main"
        className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white"
      >
        Liigu ilmaandmete juurde
      </a>

      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[#263d50] sm:gap-4">
            <div className="flex min-w-0 self-stretch">
              <a href="/" className="flex items-center gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-signal" aria-label="117.ee avaleht">
                <span className="block size-10 shrink-0" aria-hidden="true">
                  <img src="/117.png" alt="" className="size-full object-contain" />
                </span>
                <span className="hidden text-[13px] font-medium text-[#8da1b0] lg:inline">Võru ilmatöölaud</span>
              </a>

              <nav aria-label="Põhinavigatsioon" className="ml-2 flex border-l border-[#263d50] sm:ml-4">
                <a
                  href="/"
                  className="flex min-h-12 items-center border-r border-[#263d50] px-3 text-xs font-semibold text-[#a9b7c2] outline-none hover:bg-[#102538] hover:text-white focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:px-4"
                >
                  Uudised
                </a>
                <a
                  href="/ilm"
                  aria-current="page"
                  className="flex min-h-12 items-center border-r border-[#263d50] bg-[#102538] px-3 text-xs font-bold text-signal outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:px-4"
                >
                  Ilm
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="hidden text-[#8da1b0] sm:inline">
                <b className={data && failedSources.length === 0 ? "text-[#55d6b2]" : "text-[#b6a3ff]"}>
                  {data ? `${workingSourceCount}/${data.sources.length} allikat` : "—/— allikat"}
                </b>
                <span aria-hidden="true" className="ml-3 tabular-nums text-[#8295a4]">
                  {now ? `${clockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}
                </span>
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="min-h-8 border border-[#3b5870] px-2.5 font-bold text-[#c7d5df] outline-none hover:border-signal hover:text-[#7db0ff] focus-visible:ring-1 focus-visible:ring-signal"
                aria-label={theme === "dark" ? "Kasuta heledat kujundust" : "Kasuta tumedat kujundust"}
              >
                {theme === "dark" ? "Hele" : "Tume"}
              </button>
            </div>
          </div>

          <div className="flex min-h-8 items-center justify-between gap-3 border-x border-[#263d50] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890a2]">
            <span>Võru vaatlusjaam · WMO 26249</span>
            <span className="sm:hidden" aria-live="polite">
              {data ? `${workingSourceCount}/${data.sources.length} allikat` : "—/— allikat"}
            </span>
            <span className="hidden tabular-nums sm:inline">
              {data?.current ? `Vaatlus ${shortTimeFormatter.format(new Date(data.current.time)).replace(",", "")}` : "Vaatlus laadimisel"}
            </span>
          </div>
        </div>
      </header>

      <main id="weather-main" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-12 pt-4 outline-none sm:px-5 lg:px-7">
        <div className="mb-3 grid gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 text-xs font-semibold text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2] sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="font-bold text-[#245fae] dark:text-signal">Võru ilm</h1>
            <span>Mõõtmised · ajalugu · prognoos · radar</span>
          </div>
          <span aria-live="polite" className={`tabular-nums ${weatherIsStale ? "text-[#805818] dark:text-[#efb860]" : ""}`}>
            {refreshing
              ? "Värskendan ilmaandmeid…"
              : data
                ? `${weatherIsStale ? "Andmed vananenud · " : ""}Koostatud ${shortTimeFormatter.format(new Date(data.generatedAt)).replace(",", "")}`
                : "Andmeid laaditakse"}
          </span>
        </div>

        {failedSources.length > 0 && data && (
          <div role="status" className="mb-3 border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs leading-5 text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
            <b>Osalised andmed:</b> {failedSources.map((source) => source.label).join(", ")} ei vasta. Töötavad osad jäävad kasutatavaks ja puuduvad väärtused on märgitud kriipsuga.
          </div>
        )}

        {error && (
          <div role="alert" className="mb-3 flex flex-col gap-3 border border-[#9d2f2f] bg-[#b42318]/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#b42318] dark:text-[#ff6b63]">Ilmaandmete laadimine ebaõnnestus</p>
              <p className="mt-1 text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-xs font-semibold text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]"
            >
              Proovi uuesti
            </button>
          </div>
        )}

        {data && refreshError && (
          <div role="status" className="mb-3 flex flex-col gap-2 border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs leading-5 text-[#805818] dark:border-[#8f6728] dark:text-[#efb860] sm:flex-row sm:items-center sm:justify-between">
            <span><b>Värskendus hilineb:</b> {refreshError}</span>
            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="min-h-9 w-fit shrink-0 border border-[#9d762f] px-3 font-semibold outline-none hover:bg-[#d68b20]/10 focus-visible:ring-2 focus-visible:ring-[#d68b20] dark:border-[#8f6728]"
            >
              Proovi kohe
            </button>
          </div>
        )}

        {!data && loading && <WeatherLoadingState />}

        {data && (
          <div className="space-y-4">
            <CurrentConditions data={data} stale={weatherIsStale} />

            <section aria-label="Ilmaajavahemiku valik" className="border border-[#9fb2c0] bg-[#0b1b29] dark:border-[#35536a]">
              <div className="grid lg:grid-cols-[auto_1fr]">
                <div className="no-scrollbar flex overflow-x-auto border-b border-[#263d50] lg:border-b-0 lg:border-r">
                  {([
                    ["history", "Ajalugu"],
                    ["now", "Praegu"],
                    ["forecast", "Prognoos"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setView(value);
                        if (value !== "history" && (range === "30d" || range === "90d")) setRange("7d");
                      }}
                      aria-pressed={view === value}
                      className={`min-h-11 shrink-0 border-r border-[#263d50] px-5 text-[13px] font-bold outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal ${
                        view === value ? "bg-signal text-[#07131f]" : "text-[#a9b7c2] hover:bg-[#102538] hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-stretch lg:justify-end">
                  {(view === "history"
                    ? ([
                        ["24h", "24 h"],
                        ["3d", "3 p"],
                        ["7d", "7 p"],
                        ["30d", "30 p"],
                        ["90d", "90 p"],
                        ["date", "Kohandatud"],
                      ] as const)
                    : ([
                        ["24h", "24 h"],
                        ["3d", "3 p"],
                        ["7d", "7 p"],
                        ["date", "Kuupäev"],
                      ] as const)
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRange(value)}
                      aria-pressed={range === value}
                      className={`min-h-11 border-r border-[#263d50] px-4 text-xs font-semibold outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal ${
                        range === value ? "bg-[#dfe8ee] text-[#15232d] dark:bg-[#294154] dark:text-white" : "text-[#a9b7c2] hover:bg-[#102538] hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {range === "date" && (
                    <div className="flex min-h-11 flex-wrap items-center gap-2 px-3 text-[11px] font-bold text-[#a9b7c2]">
                    <label className="flex items-center gap-1.5">
                      <span className={view === "history" ? "" : "sr-only"}>{view === "history" ? "Alates" : "Valitud kuupäev"}</span>
                      <input
                        type="date"
                        value={selectedDate}
                        max={view === "history" ? [selectedEndDate || todayInput, todayInput].sort()[0] : undefined}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
                          setSelectedDate(value);
                          const nextMaximum = [shiftDate(value, 89), todayInput].sort()[0];
                          if (value > selectedEndDate) setSelectedEndDate(value);
                          else if (selectedEndDate > nextMaximum) setSelectedEndDate(nextMaximum);
                        }}
                        className="min-h-8 border border-[#3b5870] bg-[#07131f] px-2 text-xs tabular-nums text-white outline-none focus:border-signal focus:ring-1 focus:ring-signal"
                      />
                    </label>
                    {view === "history" && (
                      <label className="flex items-center gap-1.5">
                        Kuni
                        <input
                          type="date"
                          value={selectedEndDate}
                          min={selectedDate}
                          max={maximumCustomEndDate}
                          onChange={(event) => {
                            if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) setSelectedEndDate(event.target.value);
                          }}
                          className="min-h-8 border border-[#3b5870] bg-[#07131f] px-2 text-xs tabular-nums text-white outline-none focus:border-signal focus:ring-1 focus:ring-signal"
                        />
                      </label>
                    )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#263d50] px-3 py-2 text-[11px] text-[#8da1b0]">
                <span>
                  {dateTimeFormatter.format(new Date(visibleWindow.start))} — {dateTimeFormatter.format(new Date(visibleWindow.end))}
                </span>
                <span aria-live="polite" className="flex flex-wrap items-center gap-x-3">
                  {historyLoading ? (
                    <b className="text-signal">Laadin pikemat ajalugu…</b>
                  ) : (
                    <>
                      <b className="text-[#55d6b2]">{visibleObservedCount} mõõdetud</b>
                      {visibleModeledCount > 0 && <b className="text-[#c7b8ff]">{visibleModeledCount} mudelipunkti</b>}
                      {extendedHistory && extendedHistoryMatchesScope && needsExtendedHistory && (
                        <span>{extendedHistory.resolution.mode === "hourly" ? "1 h koondvaade" : "detailvaade"}</span>
                      )}
                    </>
                  )}
                  {historyCsvUrl
                    && (needsExtendedHistory ? Boolean(extendedHistory && extendedHistoryMatchesScope && extendedHistory.points.length > 0) : visibleObservedCount > 0)
                    && !historyLoading
                    && !historyError
                    && (
                    <a
                      href={historyCsvUrl}
                      download
                      title="CSV sisaldab Keskkonnaagentuuri mõõteandmeid"
                      className="border border-[#58768b] px-2 py-1 font-bold text-white outline-none hover:border-signal hover:text-signal focus-visible:ring-1 focus-visible:ring-signal"
                    >
                      Laadi CSV
                    </a>
                  )}
                </span>
              </div>
            </section>

            {historyError && needsExtendedHistory && (
              <div role="alert" className="border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
                {historyError}
              </div>
            )}

            {extendedHistory?.partial && extendedHistoryMatchesScope && needsExtendedHistory && !historyError && (
              <div role="status" className="border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
                Pikema ajaloo osa allikaid ei vastanud; kuvatakse kõik kättesaadavad mõõtmised.
              </div>
            )}

            <PeriodSummary
              points={needsExtendedHistory && extendedHistoryMatchesScope ? extendedHistory?.points ?? [] : needsExtendedHistory ? [] : historyPoints}
              startValue={periodStart}
              endValue={periodEnd}
              onStartChange={setPeriodStart}
              onEndChange={setPeriodEnd}
              maximumValue={maximumPeriodInput}
            />

            <section aria-labelledby="charts-heading">
              <p className="sr-only" aria-live="polite">
                {inspectionAnnouncement}
              </p>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-3 border-y border-[#9fb2c0] bg-[#d5e0e7] px-3 py-2 dark:border-[#35536a] dark:bg-[#102538]">
                <div>
                  <h2 id="charts-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Ilmanäitajad</h2>
                  <p className="mt-0.5 text-[11px] text-[#526878] dark:text-[#8da1b0]">Pidev joon või täistulp = mõõtmine · katkendjoon või viirutatud tulp = mudel · sinine püstsirge = praegu · kollane püstsirge = valitud aeg</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1" aria-label="Kuvatavad ilmanäitajad">
                  {METRICS.map((metric) => {
                    const active = visibleMetricIds.includes(metric.id);
                    return (
                      <button
                        key={metric.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleMetric(metric.id)}
                        className={`min-h-7 border px-2 text-[10px] font-bold outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                          active
                            ? "border-[#58768b] bg-[#0b1b29] text-white dark:border-[#58768b]"
                            : "border-[#9fb2c0] text-[#5b6f7d] hover:border-[#58768b] dark:border-[#35536a] dark:text-[#8da1b0]"
                        }`}
                      >
                        {metric.shortTitle}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {METRICS.filter((metric) => visibleMetricIds.includes(metric.id)).map((metric) => (
                  <MetricChart
                    key={metric.id}
                    metric={metric}
                    points={chartPoints}
                    startMs={visibleWindow.start}
                    endMs={visibleWindow.end}
                    nowMs={nowMs}
                    periodStartMs={periodStartMs}
                    periodEndMs={periodEndInclusiveMs}
                    inspectionMs={inspectionMs}
                    inspectionPinned={previewInspectionMs === null && pinnedInspectionMs !== null}
                    onInspectionPreview={setPreviewInspectionMs}
                    onInspectionPin={setPinnedInspectionMs}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {!data && !loading && !error && (
          <p className="border-y border-[#9fb2c0] px-3 py-4 text-xs text-[#526878] dark:border-[#35536a] dark:text-[#8da1b0]">Ilmaandmed pole saadaval.</p>
        )}

        <section aria-labelledby="radar-heading" className="mt-5">
          <div className="mb-2 border-y border-[#9fb2c0] bg-[#d5e0e7] px-3 py-2 dark:border-[#35536a] dark:bg-[#102538]">
            <h2 id="radar-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Sademeradar</h2>
            <p className="mt-0.5 text-[11px] text-[#526878] dark:text-[#8da1b0]">Radar laadib ilma mõõtegraafikutest sõltumatult.</p>
          </div>
          <WeatherRadar />
        </section>

        {data && (
          <section aria-labelledby="sources-heading" className="mt-5 border border-[#9fb2c0] dark:border-[#35536a]">
            <div className="border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
              <h2 id="sources-heading" className="text-xs font-bold text-[#2d4353] dark:text-[#c2d0d9]">Andmeallikate olek</h2>
            </div>
            <ul className="divide-y divide-[#d0dbe2] text-xs dark:divide-[#24394a]">
              {data.sources.map((source) => (
                <li key={source.id} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_8rem_12rem] sm:items-center">
                  <span className="font-semibold text-[#304654] dark:text-[#c2d0d9]">{source.label}</span>
                  <span className="text-[11px] text-[#5b6f7d] dark:text-[#8da1b0]">{source.kind === "observation" ? "Mõõtmine" : "Mudel"}</span>
                  <span className={`text-[11px] font-bold sm:text-right ${source.status === "ok" ? "text-[#087663] dark:text-[#55d6b2]" : "text-[#9d2f2f] dark:text-[#ff6b63]"}`}>
                    {source.status === "ok" ? "TÖÖTAB" : "POLE SAADAVAL"}
                    {source.updatedAt ? ` · ${shortTimeFormatter.format(new Date(source.updatedAt)).replace(",", "")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-[#9fb2c0] bg-[#dfe8ee] dark:border-[#35536a] dark:bg-[#0b1b29]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-2 px-3 py-3 text-[11px] text-[#526878] dark:text-[#7890a2] sm:px-5 lg:px-7">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span><b className="text-[#245fae] dark:text-signal">117.ee</b> · Võru ilmatöölaud</span>
            <a
              href="https://www.ilmateenistus.ee/ilm/ilmavaatlused/radar/"
              target="_blank"
              rel="noopener noreferrer external"
              className="font-semibold underline underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]"
            >
              Ava ametlik radar
            </a>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(data?.attributions ?? []).map((attribution) => (
              <a
                key={attribution.source}
                href={attribution.url}
                target="_blank"
                rel="noopener noreferrer external"
                className="underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]"
              >
                {attribution.label}{attribution.license ? ` · ${attribution.license}` : ""}
              </a>
            ))}
            {!data && (
              <>
                <a
                  href="https://www.ilmateenistus.ee/"
                  target="_blank"
                  rel="noopener noreferrer external"
                  className="underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]"
                >
                  Keskkonnaagentuur / Ilmateenistus
                </a>
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noopener noreferrer external"
                  className="underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]"
                >
                  Open-Meteo · CC BY 4.0
                </a>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
