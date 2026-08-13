import type { WeatherPoint } from "../../../lib/weather-types.ts";

const PRECIPITATION_UPDATE_MINUTE = 10;
const PRECIPITATION_SETTLE_MINUTES = 5;

export type StoredWeatherRow = {
  observed_at: Date | string;
  temperature_c: number | string | null;
  apparent_temperature_c: number | string | null;
  relative_humidity_pct: number | string | null;
  cloud_cover_pct: number | string | null;
  precipitation_mm: number | string | null;
  pressure_hpa: number | string | null;
  wind_speed_ms: number | string | null;
  wind_gust_ms: number | string | null;
  wind_direction_deg: number | string | null;
  weather_code: number | string | null;
  phenomenon: string | null;
};

function databaseNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function storedWeatherRowToPoint(row: StoredWeatherRow): WeatherPoint | null {
  const date = row.observed_at instanceof Date ? row.observed_at : new Date(row.observed_at);
  if (Number.isNaN(date.getTime())) return null;
  const isHourlyIntervalEnd = date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0
    && date.getUTCMilliseconds() === 0;

  return {
    time: date.toISOString(),
    kind: "observed",
    source: "environment_agency_current",
    temperatureC: databaseNumber(row.temperature_c),
    apparentTemperatureC: databaseNumber(row.apparent_temperature_c),
    relativeHumidityPct: databaseNumber(row.relative_humidity_pct),
    cloudCoverPct: databaseNumber(row.cloud_cover_pct),
    precipitationMm: isHourlyIntervalEnd ? databaseNumber(row.precipitation_mm) : null,
    pressureHpa: databaseNumber(row.pressure_hpa),
    windSpeedMs: databaseNumber(row.wind_speed_ms),
    windGustMs: databaseNumber(row.wind_gust_ms),
    windDirectionDeg: databaseNumber(row.wind_direction_deg),
    weatherCode: databaseNumber(row.weather_code),
    phenomenon: typeof row.phenomenon === "string" && row.phenomenon.trim()
      ? row.phenomenon.trim().slice(0, 120)
      : null,
  };
}

/** Normalizes one mixed-cadence XML observation into idempotent database rows. */
export function weatherObservationRowsForPersistence(point: WeatherPoint): WeatherPoint[] {
  if (point.kind !== "observed") return [];
  const observedAt = new Date(point.time);
  if (Number.isNaN(observedAt.getTime())) return [];

  const snapshot: WeatherPoint = { ...point, precipitationMm: null };
  if (point.precipitationMm === null || !Number.isFinite(point.precipitationMm)) {
    return [snapshot];
  }
  const minute = observedAt.getUTCMinutes();
  if (
    minute >= PRECIPITATION_UPDATE_MINUTE
    && minute < PRECIPITATION_UPDATE_MINUTE + PRECIPITATION_SETTLE_MINUTES
  ) {
    return [snapshot];
  }

  let intervalEndMs = Date.UTC(
    observedAt.getUTCFullYear(),
    observedAt.getUTCMonth(),
    observedAt.getUTCDate(),
    observedAt.getUTCHours(),
  );
  if (minute < PRECIPITATION_UPDATE_MINUTE) intervalEndMs -= 60 * 60 * 1_000;

  const hourlyPrecipitation: WeatherPoint = {
    time: new Date(intervalEndMs).toISOString(),
    kind: "observed",
    source: point.source,
    temperatureC: null,
    apparentTemperatureC: null,
    relativeHumidityPct: null,
    cloudCoverPct: null,
    precipitationMm: point.precipitationMm,
    pressureHpa: null,
    windSpeedMs: null,
    windGustMs: null,
    windDirectionDeg: null,
    weatherCode: null,
    phenomenon: null,
  };
  return [snapshot, hourlyPrecipitation];
}
