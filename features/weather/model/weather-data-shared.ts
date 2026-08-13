import type { WeatherPoint, WeatherPointKind } from "../../../lib/weather-types.ts";

export class WeatherParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherParseError";
  }
}

export function createWeatherPoint(
  time: string,
  kind: WeatherPointKind,
  source: WeatherPoint["source"],
): WeatherPoint {
  return {
    time,
    kind,
    source,
    temperatureC: null,
    apparentTemperatureC: null,
    relativeHumidityPct: null,
    cloudCoverPct: null,
    precipitationMm: null,
    pressureHpa: null,
    windSpeedMs: null,
    windGustMs: null,
    windDirectionDeg: null,
    weatherCode: null,
    phenomenon: null,
  };
}

export function hasWeatherMeasurement(point: WeatherPoint): boolean {
  return [
    point.temperatureC,
    point.relativeHumidityPct,
    point.precipitationMm,
    point.pressureHpa,
    point.windSpeedMs,
    point.windGustMs,
  ].some((value) => value !== null);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
