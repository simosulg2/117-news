import type {
  WeatherDailySummary,
  WeatherPoint,
  WeatherPointKind,
} from "../../../lib/weather-types.ts";

const TALLINN_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Tallinn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function tallinnDate(isoTime: string): string | null {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    TALLINN_DATE_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return parts.year && parts.month && parts.day
    ? `${parts.year}-${parts.month}-${parts.day}`
    : null;
}

function minimum(values: number[]): number | null {
  return values.length > 0 ? Math.min(...values) : null;
}

function maximum(values: number[]): number | null {
  return values.length > 0 ? Math.max(...values) : null;
}

function rounded(value: number, precision = 1): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function aggregateDailyWeather(points: ReadonlyArray<WeatherPoint>): WeatherDailySummary[] {
  const groups = new Map<string, WeatherPoint[]>();
  for (const point of points) {
    const date = tallinnDate(point.time);
    if (!date) continue;
    const key = `${date}:${point.kind}`;
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group]) => {
    const separator = key.lastIndexOf(":");
    const date = key.slice(0, separator);
    const kind = key.slice(separator + 1) as WeatherPointKind;
    const temperatures = group.flatMap((point) => point.temperatureC === null ? [] : [point.temperatureC]);
    const precipitation = group.flatMap((point) => point.precipitationMm === null ? [] : [point.precipitationMm]);
    const humidities = group.flatMap((point) => point.relativeHumidityPct === null ? [] : [point.relativeHumidityPct]);
    const winds = group.flatMap((point) => [point.windSpeedMs, point.windGustMs]
      .filter((value): value is number => value !== null));

    return {
      date,
      kind,
      tempMinC: minimum(temperatures),
      tempMaxC: maximum(temperatures),
      precipitationMm: precipitation.length > 0
        ? rounded(precipitation.reduce((sum, value) => sum + value, 0))
        : null,
      humidityAvgPct: humidities.length > 0
        ? rounded(humidities.reduce((sum, value) => sum + value, 0) / humidities.length)
        : null,
      windMaxMs: maximum(winds),
    };
  }).sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind));
}

/**
 * Combines chronological point collections without mutating the inputs.
 * Later collections win when they contain a non-null value at the same timestamp,
 * which lets a future persistence layer overlay stored 10-minute observations on
 * top of the daily-updated hourly archive.
 */
export function mergeWeatherPoints(
  ...collections: ReadonlyArray<ReadonlyArray<WeatherPoint>>
): WeatherPoint[] {
  const merged = new Map<string, WeatherPoint>();
  for (const collection of collections) {
    for (const point of collection) {
      const key = `${point.time}:${point.kind}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...point });
        continue;
      }

      merged.set(key, {
        ...existing,
        source: point.source,
        temperatureC: point.temperatureC ?? existing.temperatureC,
        apparentTemperatureC: point.apparentTemperatureC ?? existing.apparentTemperatureC,
        relativeHumidityPct: point.relativeHumidityPct ?? existing.relativeHumidityPct,
        cloudCoverPct: point.cloudCoverPct ?? existing.cloudCoverPct,
        precipitationMm: point.precipitationMm ?? existing.precipitationMm,
        pressureHpa: point.pressureHpa ?? existing.pressureHpa,
        windSpeedMs: point.windSpeedMs ?? existing.windSpeedMs,
        windGustMs: point.windGustMs ?? existing.windGustMs,
        windDirectionDeg: point.windDirectionDeg ?? existing.windDirectionDeg,
        weatherCode: point.weatherCode ?? existing.weatherCode,
        phenomenon: point.phenomenon ?? existing.phenomenon,
      });
    }
  }
  return [...merged.values()].sort((left, right) => left.time.localeCompare(right.time));
}
