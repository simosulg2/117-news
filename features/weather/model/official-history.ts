import type { WeatherPoint } from "../../../lib/weather-types.ts";
import {
  createWeatherPoint,
  finiteNumber,
  hasWeatherMeasurement,
  isRecord,
  WeatherParseError,
} from "./weather-data-shared.ts";

const OFFICIAL_HISTORY_ELEMENTS = new Set([
  "PA0",
  "PR1H",
  "RH",
  "TA",
  "WD10M",
  "WS10M",
  "WSX1H",
]);

type ParsedOfficialHistory = {
  points: WeatherPoint[];
  updatedAt: string | null;
};

function integerField(
  record: Record<string, unknown>,
  field: string,
  minimum: number,
  maximum: number,
): number | null {
  const value = record[field];
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum
    ? value as number
    : null;
}

function validUtcObservationTime(year: number, month: number, day: number, hour: number): Date | null {
  // Keskkonnaagentuur publishes the f_kliima_tund calendar fields in UTC.
  const date = new Date(Date.UTC(year, month - 1, day, hour));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
  ) return null;
  return date;
}

export function parseOfficialHistoryRows(input: unknown): ParsedOfficialHistory {
  if (!Array.isArray(input)) {
    throw new WeatherParseError("Official history response was not an array");
  }

  const byTime = new Map<string, WeatherPoint>();
  let newestDatasetUpdate = Number.NEGATIVE_INFINITY;

  for (const raw of input) {
    if (!isRecord(raw)) throw new WeatherParseError("Official history row was invalid");

    const year = integerField(raw, "aasta", 1991, 2200);
    const month = integerField(raw, "kuu", 1, 12);
    const day = integerField(raw, "paev", 1, 31);
    const hour = integerField(raw, "tund", 0, 23);
    const element = typeof raw.element_kood === "string" ? raw.element_kood : null;
    if (year === null || month === null || day === null || hour === null || !element) {
      throw new WeatherParseError("Official history row fields were invalid");
    }
    if (!OFFICIAL_HISTORY_ELEMENTS.has(element)) continue;

    const date = validUtcObservationTime(year, month, day, hour);
    if (!date) throw new WeatherParseError("Official history row date was invalid");
    const time = date.toISOString();
    const point = byTime.get(time)
      ?? createWeatherPoint(time, "observed", "environment_agency_history");
    const value = finiteNumber(raw.vaartus);

    if (value !== null) {
      switch (element) {
        case "TA": point.temperatureC = value; break;
        case "RH": point.relativeHumidityPct = value; break;
        case "PR1H": point.precipitationMm = value; break;
        case "PA0": point.pressureHpa = value; break;
        case "WS10M": point.windSpeedMs = value; break;
        case "WSX1H": point.windGustMs = value; break;
        case "WD10M": point.windDirectionDeg = value; break;
      }
    }
    byTime.set(time, point);

    if (typeof raw.avaandmed_ts === "string") {
      const update = Date.parse(raw.avaandmed_ts);
      if (Number.isFinite(update)) newestDatasetUpdate = Math.max(newestDatasetUpdate, update);
    }
  }

  const points = [...byTime.values()]
    .filter(hasWeatherMeasurement)
    .sort((left, right) => left.time.localeCompare(right.time));

  return {
    points,
    updatedAt: Number.isFinite(newestDatasetUpdate)
      ? new Date(newestDatasetUpdate).toISOString()
      : null,
  };
}
