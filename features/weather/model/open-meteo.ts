import type { WeatherPoint } from "../../../lib/weather-types.ts";
import {
  createWeatherPoint,
  finiteNumber,
  isRecord,
  WeatherParseError,
} from "./weather-data-shared.ts";

type ParsedOpenMeteo = {
  modeledHistory: WeatherPoint[];
  forecast: WeatherPoint[];
  updatedAt: string;
};

function numericSeries(
  hourly: Record<string, unknown>,
  field: string,
  expectedLength: number,
): Array<number | null> {
  const series = hourly[field];
  if (!Array.isArray(series) || series.length !== expectedLength) {
    throw new WeatherParseError(`Open-Meteo ${field} series was invalid`);
  }
  return series.map((value) => {
    if (value === null) return null;
    const number = finiteNumber(value);
    if (number === null) throw new WeatherParseError(`Open-Meteo ${field} value was invalid`);
    return number;
  });
}

function openMeteoTime(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseOpenMeteoResponse(input: unknown, fetchedAt = new Date()): ParsedOpenMeteo {
  if (!isRecord(input) || !isRecord(input.hourly) || input.utc_offset_seconds !== 0) {
    throw new WeatherParseError("Open-Meteo response metadata was invalid");
  }
  const times = input.hourly.time;
  if (!Array.isArray(times) || times.length === 0 || times.length > 1_000) {
    throw new WeatherParseError("Open-Meteo time series was invalid");
  }

  const fields = {
    temperatureC: numericSeries(input.hourly, "temperature_2m", times.length),
    apparentTemperatureC: numericSeries(input.hourly, "apparent_temperature", times.length),
    relativeHumidityPct: numericSeries(input.hourly, "relative_humidity_2m", times.length),
    cloudCoverPct: numericSeries(input.hourly, "cloud_cover", times.length),
    precipitationMm: numericSeries(input.hourly, "precipitation", times.length),
    pressureHpa: numericSeries(input.hourly, "pressure_msl", times.length),
    windSpeedMs: numericSeries(input.hourly, "wind_speed_10m", times.length),
    windGustMs: numericSeries(input.hourly, "wind_gusts_10m", times.length),
    windDirectionDeg: numericSeries(input.hourly, "wind_direction_10m", times.length),
    weatherCode: numericSeries(input.hourly, "weather_code", times.length),
  };

  const splitAt = Date.UTC(
    fetchedAt.getUTCFullYear(),
    fetchedAt.getUTCMonth(),
    fetchedAt.getUTCDate(),
    fetchedAt.getUTCHours(),
  );
  const modeledHistory: WeatherPoint[] = [];
  const forecast: WeatherPoint[] = [];

  times.forEach((rawTime, index) => {
    const date = openMeteoTime(rawTime);
    if (!date) throw new WeatherParseError("Open-Meteo timestamp was invalid");
    const point = createWeatherPoint(date.toISOString(), "modeled", "open_meteo");
    point.temperatureC = fields.temperatureC[index];
    point.apparentTemperatureC = fields.apparentTemperatureC[index];
    point.relativeHumidityPct = fields.relativeHumidityPct[index];
    point.cloudCoverPct = fields.cloudCoverPct[index];
    point.precipitationMm = fields.precipitationMm[index];
    point.pressureHpa = fields.pressureHpa[index];
    point.windSpeedMs = fields.windSpeedMs[index];
    point.windGustMs = fields.windGustMs[index];
    point.windDirectionDeg = fields.windDirectionDeg[index];
    point.weatherCode = fields.weatherCode[index];
    (date.getTime() < splitAt ? modeledHistory : forecast).push(point);
  });

  return {
    modeledHistory,
    forecast,
    updatedAt: fetchedAt.toISOString(),
  };
}
