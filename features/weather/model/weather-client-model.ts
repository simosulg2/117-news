import { resolveTallinnLocalTime, TALLINN_TIME_ZONE } from "../../../lib/weather-time.ts";
import type { WeatherPoint } from "../../../lib/weather-types.ts";

export const HOUR_MS = 60 * 60 * 1_000;
export const DAY_MS = 24 * HOUR_MS;
export const WEATHER_REFRESH_MS = 5 * 60 * 1_000;
export const WEATHER_STALE_AFTER_MS = 20 * 60 * 1_000;
export const CURRENT_OBSERVATION_STALE_AFTER_MS = 30 * 60 * 1_000;
export const WEATHER_PREFERENCES_KEY = "117-weather-preferences";

export function shouldRefreshWeather(lastSnapshotAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(lastSnapshotAtMs) || lastSnapshotAtMs <= 0 || !Number.isFinite(nowMs)) {
    return true;
  }
  const elapsed = nowMs - lastSnapshotAtMs;
  return elapsed < 0 || elapsed >= WEATHER_REFRESH_MS;
}

export type WeatherView = "history" | "now" | "forecast";
export type WeatherRange = "24h" | "3d" | "7d" | "30d" | "90d" | "date";
export type MetricField =
  | "temperatureC"
  | "relativeHumidityPct"
  | "cloudCoverPct"
  | "precipitationMm"
  | "windSpeedMs"
  | "windGustMs"
  | "pressureHpa";

export type MetricDefinition = {
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

export const METRICS: readonly MetricDefinition[] = [
  { id: "temperature", title: "Õhutemperatuur", shortTitle: "Temperatuur", unit: "°C", field: "temperatureC", color: "#d9473f" },
  { id: "humidity", title: "Suhteline õhuniiskus", shortTitle: "Niiskus", unit: "%", field: "relativeHumidityPct", color: "#087663", fixedMin: 0, fixedMax: 100 },
  { id: "cloud", title: "Pilvisus", shortTitle: "Pilvisus", unit: "%", field: "cloudCoverPct", color: "#687c8a", fixedMin: 0, fixedMax: 100 },
  { id: "precipitation", title: "Sademed tunnis", shortTitle: "Sademed", unit: "mm", field: "precipitationMm", color: "#2268bd", fixedMin: 0, bars: true },
  { id: "wind", title: "Tuul ja puhangud", shortTitle: "Tuul", unit: "m/s", field: "windSpeedMs", secondaryField: "windGustMs", secondaryLabel: "Puhang", color: "#6f56b3", secondaryColor: "#ce7b20", fixedMin: 0 },
  { id: "pressure", title: "Õhurõhk merepinnal", shortTitle: "Õhurõhk", unit: "hPa", field: "pressureHpa", color: "#18795d" },
];

const dateInputFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TALLINN_TIME_ZONE,
});

export function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function rangeWindow(
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
    const endResult = resolveTallinnLocalTime(`${shiftDate(finalDate, 1)}T00:00`);
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

export function deduplicatePoints(points: readonly WeatherPoint[]): WeatherPoint[] {
  const unique = new Map<string, WeatherPoint>();
  for (const point of points) unique.set(`${point.kind}:${point.source}:${point.time}`, point);
  return [...unique.values()].sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
}

export function fieldValue(point: WeatherPoint, field: MetricField): number | null {
  const value = point[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function pathSegments(
  points: readonly WeatherPoint[],
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

export function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length;
}

export function sum(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
}

export function minimum(values: readonly number[]): number | null {
  return values.length > 0 ? Math.min(...values) : null;
}

export function maximum(values: readonly number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

export type MetricSamples = {
  values: number[];
  kind: WeatherPoint["kind"] | null;
  observedCount: number;
  modeledCount: number;
};

export function pointsForField(points: readonly WeatherPoint[], field: MetricField): MetricSamples {
  const observed = points
    .filter((point) => point.kind === "observed")
    .map((point) => fieldValue(point, field))
    .filter((value): value is number => value !== null);
  const modeled = points
    .filter((point) => point.kind === "modeled")
    .map((point) => fieldValue(point, field))
    .filter((value): value is number => value !== null);
  if (observed.length > 0) {
    return { values: observed, kind: "observed", observedCount: observed.length, modeledCount: modeled.length };
  }
  return { values: modeled, kind: modeled.length > 0 ? "modeled" : null, observedCount: 0, modeledCount: modeled.length };
}

export type PeriodPointSummary = {
  selectedPoints: WeatherPoint[];
  samples: Record<MetricField, MetricSamples>;
  phenomenonSamples: string[];
  phenomenon: string | null;
  observedCount: number;
  modeledCount: number;
};

export function summarizePeriodPoints(
  points: readonly WeatherPoint[],
  startMs: number,
  inclusiveEndMs: number,
): PeriodPointSummary {
  const selectedPoints = points.filter((point) => {
    const time = Date.parse(point.time);
    return Number.isFinite(time) && time >= startMs && time <= inclusiveEndMs;
  });
  const fields: MetricField[] = ["temperatureC", "relativeHumidityPct", "cloudCoverPct", "precipitationMm", "windSpeedMs", "windGustMs", "pressureHpa"];
  const samples = Object.fromEntries(fields.map((field) => [field, pointsForField(selectedPoints, field)])) as Record<MetricField, MetricSamples>;
  const phenomenonSamples = selectedPoints
    .filter((point) => point.kind === "observed" && Boolean(point.phenomenon?.trim()))
    .map((point) => point.phenomenon!.trim());
  const counts = new Map<string, number>();
  for (const value of phenomenonSamples) counts.set(value, (counts.get(value) ?? 0) + 1);
  const phenomenon = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  return {
    selectedPoints,
    samples,
    phenomenonSamples,
    phenomenon,
    observedCount: new Set(selectedPoints.filter((point) => point.kind === "observed").map((point) => point.time)).size,
    modeledCount: new Set(selectedPoints.filter((point) => point.kind === "modeled").map((point) => point.time)).size,
  };
}

export function filterPointsByWindow(points: readonly WeatherPoint[], start: number, end: number): WeatherPoint[] {
  return points.filter((point) => {
    const time = Date.parse(point.time);
    return Number.isFinite(time) && time >= start && time <= end;
  });
}
