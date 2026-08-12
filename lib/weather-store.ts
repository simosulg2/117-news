import { Pool, type QueryResultRow } from "pg";

import type { WeatherPoint } from "./weather-types";

const STATION_WMO_CODE = "26249";
const MAX_HISTORY_RANGE_MS = 31 * 24 * 60 * 60 * 1_000;
// The XML feed publishes the previous full hour's precipitation ten minutes
// after the hour. Requests in the short update window are deliberately not
// persisted as rainfall; a later request safely fills the canonical row.
const PRECIPITATION_UPDATE_MINUTE = 10;
const PRECIPITATION_SETTLE_MINUTES = 5;

type WeatherStoreGlobal = typeof globalThis & {
  __weatherPool117?: Pool;
};

type StoredWeatherRow = QueryResultRow & {
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

let schemaPromise: Promise<void> | null = null;
let invalidConfigurationLogged = false;

function databaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
    return value;
  } catch {
    if (!invalidConfigurationLogged) {
      invalidConfigurationLogged = true;
      console.error("Weather persistence is disabled because DATABASE_URL is not a valid PostgreSQL URL");
    }
    return null;
  }
}

function weatherPool(): Pool | null {
  const connectionString = databaseUrl();
  if (!connectionString) return null;

  const shared = globalThis as WeatherStoreGlobal;
  if (!shared.__weatherPool117) {
    const pool = new Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
    // pg reports failures on idle clients through the Pool's error event.
    // Handling it here keeps an optional database outage from terminating the
    // Next.js process, while deliberately avoiding credentials in the log.
    pool.on("error", (error: Error & { code?: unknown }) => {
      console.error("Weather persistence idle connection failed", {
        name: error.name,
        code: error.code === undefined ? undefined : String(error.code).slice(0, 40),
      });
    });
    shared.__weatherPool117 = pool;
  }
  return shared.__weatherPool117;
}

async function ensureSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS weather_observations (
        station_wmo_code TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL,
        temperature_c DOUBLE PRECISION,
        apparent_temperature_c DOUBLE PRECISION,
        relative_humidity_pct DOUBLE PRECISION,
        cloud_cover_pct DOUBLE PRECISION,
        precipitation_mm DOUBLE PRECISION,
        pressure_hpa DOUBLE PRECISION,
        wind_speed_ms DOUBLE PRECISION,
        wind_gust_ms DOUBLE PRECISION,
        wind_direction_deg DOUBLE PRECISION,
        weather_code INTEGER,
        phenomenon TEXT,
        source TEXT NOT NULL,
        collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (station_wmo_code, observed_at)
      )
    `).then(() => undefined).catch((error: unknown) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function finiteOrNull(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

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
    // Additive precipitation is valid only on the canonical interval-end rows
    // produced below. This also prevents pre-normalization snapshot rows from
    // being summed repeatedly if a deployment already collected any of them.
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

export function weatherStoreConfigured(): boolean {
  return databaseUrl() !== null;
}

/**
 * Converts one mixed-cadence XML observation into database rows with explicit
 * interval semantics. Instantaneous fields keep the feed timestamp. The XML
 * precipitation value is a rolling value for the preceding full hour, so it
 * is removed from the 10-minute snapshot and placed on one canonical hourly
 * interval-end row. Repeated requests then upsert the same row instead of
 * making an additive value appear several times.
 */
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
  if (minute < PRECIPITATION_UPDATE_MINUTE) {
    intervalEndMs -= 60 * 60 * 1_000;
  }

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

async function upsertWeatherObservation(pool: Pool, point: WeatherPoint): Promise<void> {
  const observedAt = new Date(point.time);
  if (Number.isNaN(observedAt.getTime())) return;

  await pool.query(
    `
      INSERT INTO weather_observations (
        station_wmo_code,
        observed_at,
        temperature_c,
        apparent_temperature_c,
        relative_humidity_pct,
        cloud_cover_pct,
        precipitation_mm,
        pressure_hpa,
        wind_speed_ms,
        wind_gust_ms,
        wind_direction_deg,
        weather_code,
        phenomenon,
        source
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (station_wmo_code, observed_at) DO UPDATE SET
        temperature_c = COALESCE(EXCLUDED.temperature_c, weather_observations.temperature_c),
        apparent_temperature_c = COALESCE(EXCLUDED.apparent_temperature_c, weather_observations.apparent_temperature_c),
        relative_humidity_pct = COALESCE(EXCLUDED.relative_humidity_pct, weather_observations.relative_humidity_pct),
        cloud_cover_pct = COALESCE(EXCLUDED.cloud_cover_pct, weather_observations.cloud_cover_pct),
        precipitation_mm = EXCLUDED.precipitation_mm,
        pressure_hpa = COALESCE(EXCLUDED.pressure_hpa, weather_observations.pressure_hpa),
        wind_speed_ms = COALESCE(EXCLUDED.wind_speed_ms, weather_observations.wind_speed_ms),
        wind_gust_ms = COALESCE(EXCLUDED.wind_gust_ms, weather_observations.wind_gust_ms),
        wind_direction_deg = COALESCE(EXCLUDED.wind_direction_deg, weather_observations.wind_direction_deg),
        weather_code = COALESCE(EXCLUDED.weather_code, weather_observations.weather_code),
        phenomenon = COALESCE(EXCLUDED.phenomenon, weather_observations.phenomenon),
        source = EXCLUDED.source,
        collected_at = NOW()
    `,
    [
      STATION_WMO_CODE,
      observedAt,
      finiteOrNull(point.temperatureC),
      finiteOrNull(point.apparentTemperatureC),
      finiteOrNull(point.relativeHumidityPct),
      finiteOrNull(point.cloudCoverPct),
      finiteOrNull(point.precipitationMm),
      finiteOrNull(point.pressureHpa),
      finiteOrNull(point.windSpeedMs),
      finiteOrNull(point.windGustMs),
      finiteOrNull(point.windDirectionDeg),
      finiteOrNull(point.weatherCode),
      point.phenomenon?.trim().slice(0, 120) || null,
      point.source,
    ],
  );
}

export async function saveWeatherObservation(point: WeatherPoint): Promise<boolean> {
  const pool = weatherPool();
  if (!pool || point.kind !== "observed") return false;

  const rows = weatherObservationRowsForPersistence(point);
  if (rows.length === 0) return false;
  await ensureSchema(pool);
  for (const row of rows) await upsertWeatherObservation(pool, row);
  return true;
}

export async function loadStoredWeatherObservations(from: Date, to: Date): Promise<WeatherPoint[]> {
  const pool = weatherPool();
  if (!pool) return [];

  const fromTime = from.getTime();
  const toTime = to.getTime();
  if (
    !Number.isFinite(fromTime)
    || !Number.isFinite(toTime)
    || fromTime > toTime
    || toTime - fromTime > MAX_HISTORY_RANGE_MS
  ) return [];

  await ensureSchema(pool);
  const result = await pool.query<StoredWeatherRow>(
    `
      SELECT
        observed_at,
        temperature_c,
        apparent_temperature_c,
        relative_humidity_pct,
        cloud_cover_pct,
        precipitation_mm,
        pressure_hpa,
        wind_speed_ms,
        wind_gust_ms,
        wind_direction_deg,
        weather_code,
        phenomenon
      FROM weather_observations
      WHERE station_wmo_code = $1
        AND observed_at >= $2
        AND observed_at <= $3
      ORDER BY observed_at ASC
      LIMIT 5000
    `,
    [STATION_WMO_CODE, from, to],
  );

  return result.rows
    .map(storedWeatherRowToPoint)
    .filter((point): point is WeatherPoint => point !== null);
}
