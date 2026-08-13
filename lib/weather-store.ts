import { Pool, type PoolConfig } from "pg";

import type { WeatherPoint } from "./weather-types";
import {
  storedWeatherRowToPoint,
  weatherObservationRowsForPersistence,
  type StoredWeatherRow,
} from "../features/weather/model/weather-persistence.ts";

export {
  storedWeatherRowToPoint,
  weatherObservationRowsForPersistence,
} from "../features/weather/model/weather-persistence.ts";

const STATION_WMO_CODE = "26249";
const MAX_HISTORY_RANGE_MS = 31 * 24 * 60 * 60 * 1_000;
const MAX_EXTENDED_HISTORY_RANGE_MS = 90 * 24 * 60 * 60 * 1_000 + 60 * 60 * 1_000;
// Six ten-minute snapshots plus one canonical precipitation row per hour are
// roughly 15,120 rows across a full 90-day window. Keep a little headroom so
// a complete collector history is not truncated at the advertised limit.
const MAX_EXTENDED_HISTORY_ROWS = 20_000;
const DATABASE_TIMEOUT_MS = 5_000;

type WeatherStoreGlobal = typeof globalThis & {
  __weatherPool117?: Pool;
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

export function weatherPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    max: 3,
    connectionTimeoutMillis: DATABASE_TIMEOUT_MS,
    statement_timeout: DATABASE_TIMEOUT_MS,
    lock_timeout: DATABASE_TIMEOUT_MS,
    query_timeout: DATABASE_TIMEOUT_MS,
    idleTimeoutMillis: 30_000,
  };
}

function weatherPool(): Pool | null {
  const connectionString = databaseUrl();
  if (!connectionString) return null;

  const shared = globalThis as WeatherStoreGlobal;
  if (!shared.__weatherPool117) {
    const pool = new Pool(weatherPoolConfig(connectionString));
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

export function weatherStoreConfigured(): boolean {
  return databaseUrl() !== null;
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

export type StoredWeatherObservationRange = {
  points: WeatherPoint[];
  truncated: boolean;
};

/**
 * Loads the longer, explicitly requested history window without changing the
 * conservative limits used by the normal weather-page request. One extra row
 * is requested so callers can report incomplete database coverage honestly
 * instead of silently treating a SQL LIMIT as complete history.
 */
export async function loadStoredWeatherObservationRange(
  from: Date,
  to: Date,
): Promise<StoredWeatherObservationRange> {
  const pool = weatherPool();
  if (!pool) return { points: [], truncated: false };

  const fromTime = from.getTime();
  const toTime = to.getTime();
  if (
    !Number.isFinite(fromTime)
    || !Number.isFinite(toTime)
    || fromTime >= toTime
    || toTime - fromTime > MAX_EXTENDED_HISTORY_RANGE_MS
  ) return { points: [], truncated: false };

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
        AND observed_at < $3
      ORDER BY observed_at ASC
      LIMIT $4
    `,
    [STATION_WMO_CODE, from, to, MAX_EXTENDED_HISTORY_ROWS + 1],
  );

  const truncated = result.rows.length > MAX_EXTENDED_HISTORY_ROWS;
  const rows = truncated ? result.rows.slice(0, MAX_EXTENDED_HISTORY_ROWS) : result.rows;
  return {
    points: rows
      .map(storedWeatherRowToPoint)
      .filter((point): point is WeatherPoint => point !== null),
    truncated,
  };
}
