import type { WeatherPoint, WeatherPointKind } from "./weather-types";

const DAY_MS = 24 * 60 * 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;
const EXPLICIT_ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

export const WEATHER_HISTORY_MAX_RANGE_DAYS = 90;
export const WEATHER_HISTORY_DETAIL_RANGE_DAYS = 7;
export const WEATHER_HISTORY_EARLIEST_YEAR = 1991;

export type WeatherHistoryRange = {
  from: string;
  to: string;
  fromMs: number;
  toMs: number;
  durationMs: number;
};

export type WeatherHistoryRangeErrorCode = "missing" | "invalid" | "order" | "future" | "too_long";

export type WeatherHistoryRangeValidation =
  | { ok: true; range: WeatherHistoryRange }
  | { ok: false; error: { code: WeatherHistoryRangeErrorCode; message: string } };

function isValidExplicitIsoTimestamp(value: string): boolean {
  const match = EXPLICIT_ISO_TIMESTAMP.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? 0);
  const millisecond = Number((match[7] ?? "0").padEnd(3, "0"));
  const offsetHour = Number(match[8] ?? 0);
  const offsetMinute = Number(match[9] ?? 0);
  if (offsetHour > 23 || offsetMinute > 59) return false;

  const civilTime = new Date(0);
  civilTime.setUTCFullYear(year, month - 1, day);
  civilTime.setUTCHours(hour, minute, second, millisecond);
  return civilTime.getUTCFullYear() === year
    && civilTime.getUTCMonth() === month - 1
    && civilTime.getUTCDate() === day
    && civilTime.getUTCHours() === hour
    && civilTime.getUTCMinutes() === minute
    && civilTime.getUTCSeconds() === second;
}

export function validateWeatherHistoryRange(
  fromValue: string | null | undefined,
  toValue: string | null | undefined,
  options: { now?: Date | number; maxRangeDays?: number } = {},
): WeatherHistoryRangeValidation {
  if (!fromValue || !toValue) {
    return { ok: false, error: { code: "missing", message: "from and to timestamps are required" } };
  }
  if (!isValidExplicitIsoTimestamp(fromValue) || !isValidExplicitIsoTimestamp(toValue)) {
    return { ok: false, error: { code: "invalid", message: "from and to must be ISO timestamps with a timezone" } };
  }

  const fromMs = Date.parse(fromValue);
  const toMs = Date.parse(toValue);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return { ok: false, error: { code: "invalid", message: "from or to is not a valid timestamp" } };
  }
  if (fromMs >= toMs) {
    return { ok: false, error: { code: "order", message: "from must be earlier than to" } };
  }
  if (new Date(fromMs).getUTCFullYear() < WEATHER_HISTORY_EARLIEST_YEAR) {
    return { ok: false, error: { code: "invalid", message: "history starts before the supported archive" } };
  }

  const nowValue = options.now instanceof Date ? options.now.getTime() : options.now ?? Date.now();
  if (!Number.isFinite(nowValue) || toMs > nowValue) {
    return { ok: false, error: { code: "future", message: "history cannot end in the future" } };
  }

  const maximumDays = options.maxRangeDays ?? WEATHER_HISTORY_MAX_RANGE_DAYS;
  const durationMs = toMs - fromMs;
  // Calendar ranges that cross Tallinn's autumn DST boundary may contain one
  // extra UTC hour. Keep the public calendar-day limit while tolerating that
  // single timezone transition.
  if (!Number.isFinite(maximumDays) || maximumDays <= 0 || durationMs > maximumDays * DAY_MS + HOUR_MS) {
    return {
      ok: false,
      error: { code: "too_long", message: `history range cannot exceed ${maximumDays} days` },
    };
  }

  return {
    ok: true,
    range: {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      fromMs,
      toMs,
      durationMs,
    },
  };
}

const AVERAGED_FIELDS = [
  "temperatureC",
  "apparentTemperatureC",
  "relativeHumidityPct",
  "cloudCoverPct",
  "pressureHpa",
  "windSpeedMs",
] as const satisfies readonly (keyof WeatherPoint)[];

function finiteValues(points: WeatherPoint[], field: keyof WeatherPoint): number[] {
  return points
    .map((point) => point[field])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function total(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}

function maximum(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}

function mode<T extends string | number>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function circularMean(values: number[]): number | null {
  if (values.length === 0) return null;
  const radians = values.map((value) => (value * Math.PI) / 180);
  const x = radians.reduce((sum, value) => sum + Math.cos(value), 0) / radians.length;
  const y = radians.reduce((sum, value) => sum + Math.sin(value), 0) / radians.length;
  if (Math.hypot(x, y) < 0.01) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function aggregateHour(points: WeatherPoint[], hourMs: number, kind: WeatherPointKind, minimumTime: number): WeatherPoint {
  const firstSampleTime = Math.min(
    ...points.map((point) => Date.parse(point.time)).filter(Number.isFinite),
  );
  const result: WeatherPoint = {
    time: new Date(hourMs < minimumTime ? firstSampleTime : hourMs).toISOString(),
    kind,
    source: kind === "modeled"
      ? "open_meteo"
      : points.some((point) => point.source === "environment_agency_current")
        ? "environment_agency_current"
        : "environment_agency_history",
    temperatureC: null,
    apparentTemperatureC: null,
    relativeHumidityPct: null,
    cloudCoverPct: null,
    precipitationMm: total(finiteValues(points, "precipitationMm")),
    pressureHpa: null,
    windSpeedMs: null,
    windGustMs: maximum(finiteValues(points, "windGustMs")),
    windDirectionDeg: circularMean(finiteValues(points, "windDirectionDeg")),
    weatherCode: mode(finiteValues(points, "weatherCode")),
    phenomenon: mode(points.map((point) => point.phenomenon?.trim()).filter((value): value is string => Boolean(value))),
  };
  for (const field of AVERAGED_FIELDS) result[field] = mean(finiteValues(points, field));
  return result;
}

function pointsInRange(points: WeatherPoint[], range: WeatherHistoryRange): WeatherPoint[] {
  return points
    .filter((point) => {
      const time = Date.parse(point.time);
      return Number.isFinite(time) && time >= range.fromMs && time < range.toMs;
    })
    .sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
}

export function aggregateWeatherHistoryForChart(points: WeatherPoint[], range: WeatherHistoryRange) {
  const ranged = pointsInRange(points, range);
  const detail = range.durationMs <= WEATHER_HISTORY_DETAIL_RANGE_DAYS * DAY_MS;
  let chartPoints = ranged;

  if (!detail) {
    const buckets = new Map<string, WeatherPoint[]>();
    for (const point of ranged) {
      const hourMs = Math.floor(Date.parse(point.time) / HOUR_MS) * HOUR_MS;
      const key = `${point.kind}:${hourMs}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(point);
      else buckets.set(key, [point]);
    }
    chartPoints = [...buckets.entries()]
      .map(([key, bucket]) => {
        const [kind, hour] = key.split(":") as [WeatherPointKind, string];
        return aggregateHour(bucket, Number(hour), kind, range.fromMs);
      })
      .sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
  }

  return {
    points: chartPoints,
    resolution: {
      mode: detail ? "detail" as const : "hourly" as const,
      intervalMinutes: detail ? null : 60,
    },
    coverage: {
      from: chartPoints[0]?.time ?? null,
      to: chartPoints.at(-1)?.time ?? null,
      pointCount: chartPoints.length,
    },
  };
}

export function findNearestWeatherPoint(
  points: readonly WeatherPoint[],
  targetMs: number,
  maximumDistanceMs = Number.POSITIVE_INFINITY,
): WeatherPoint | null {
  if (!Number.isFinite(targetMs) || maximumDistanceMs < 0) return null;
  let nearest: WeatherPoint | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const time = Date.parse(point.time);
    if (!Number.isFinite(time)) continue;
    const distance = Math.abs(time - targetMs);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  return nearestDistance <= maximumDistanceMs ? nearest : null;
}

const tallinnCsvFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Tallinn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function spreadsheetSafe(value: string): string {
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number | null): string {
  const raw = value === null
    ? ""
    : typeof value === "number"
      ? String(value)
      : spreadsheetSafe(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function createWeatherHistoryCsv(
  points: readonly WeatherPoint[],
  options: { location?: string } = {},
): string {
  const headers = [
    "time_utc", "time_tallinn", "location", "kind", "source", "temperature_c",
    "apparent_temperature_c", "relative_humidity_pct", "cloud_cover_pct",
    "precipitation_mm", "pressure_hpa", "wind_speed_ms", "wind_gust_ms",
    "wind_direction_deg", "weather_code", "phenomenon",
  ];
  const rows = [...points]
    .filter((point) => Number.isFinite(Date.parse(point.time)))
    .sort((left, right) => Date.parse(left.time) - Date.parse(right.time))
    .map((point) => [
      new Date(point.time).toISOString(),
      tallinnCsvFormatter.format(new Date(point.time)).replace(" ", "T"),
      options.location ?? "Võru",
      point.kind,
      point.source,
      point.temperatureC,
      point.apparentTemperatureC,
      point.relativeHumidityPct,
      point.cloudCoverPct,
      point.precipitationMm,
      point.pressureHpa,
      point.windSpeedMs,
      point.windGustMs,
      point.windDirectionDeg,
      point.weatherCode,
      point.phenomenon,
    ].map(csvCell).join(","));
  return `\uFEFF${headers.join(",")}\r\n${rows.join("\r\n")}${rows.length > 0 ? "\r\n" : ""}`;
}
