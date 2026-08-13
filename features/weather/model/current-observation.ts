import type { WeatherPoint } from "../../../lib/weather-types.ts";
import {
  createWeatherPoint,
  hasWeatherMeasurement,
  WeatherParseError,
} from "./weather-data-shared.ts";

type ParsedCurrentObservation = {
  point: WeatherPoint;
  updatedAt: string;
};

function safeCodePoint(value: string, radix: number): string {
  const codePoint = Number.parseInt(value, radix);
  return Number.isInteger(codePoint)
    && codePoint >= 0
    && codePoint <= 0x10FFFF
    && !(codePoint >= 0xD800 && codePoint <= 0xDFFF)
    ? String.fromCodePoint(codePoint)
    : "�";
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code: string) => safeCodePoint(code, 10))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => safeCodePoint(code, 16))
    .trim();
}

function xmlTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  if (!match) return null;
  return decodeXmlText(match[1]);
}

function xmlNumber(
  block: string,
  tag: string,
  minimum: number,
  maximum: number,
): number | null {
  const value = xmlTag(block, tag);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

export function parseCurrentObservationXml(xml: string): ParsedCurrentObservation {
  if (typeof xml !== "string" || xml.length === 0) {
    throw new WeatherParseError("Current observation XML was empty");
  }

  const timestampMatch = /<observations\b[^>]*\btimestamp=(?:"(\d+)"|'(\d+)')[^>]*>/i.exec(xml);
  const timestampSeconds = Number(timestampMatch?.[1] ?? timestampMatch?.[2]);
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    throw new WeatherParseError("Current observation timestamp was invalid");
  }

  let stationBlock: string | null = null;
  for (const match of xml.matchAll(/<station\b[^>]*>([\s\S]*?)<\/station>/gi)) {
    if (xmlTag(match[1], "wmocode") === "26249") {
      stationBlock = match[1];
      break;
    }
  }
  if (!stationBlock) throw new WeatherParseError("Võru observation station was missing");

  const updatedAt = new Date(timestampSeconds * 1_000);
  if (Number.isNaN(updatedAt.getTime())) {
    throw new WeatherParseError("Current observation timestamp was outside the supported range");
  }

  const point = createWeatherPoint(
    updatedAt.toISOString(),
    "observed",
    "environment_agency_current",
  );
  point.temperatureC = xmlNumber(stationBlock, "airtemperature", -100, 70);
  point.relativeHumidityPct = xmlNumber(stationBlock, "relativehumidity", 0, 100);
  point.precipitationMm = xmlNumber(stationBlock, "precipitations", 0, 1_000);
  point.pressureHpa = xmlNumber(stationBlock, "airpressure", 800, 1_100);
  point.windSpeedMs = xmlNumber(stationBlock, "windspeed", 0, 150);
  point.windGustMs = xmlNumber(stationBlock, "windspeedmax", 0, 150);
  point.windDirectionDeg = xmlNumber(stationBlock, "winddirection", 0, 360);
  const phenomenon = xmlTag(stationBlock, "phenomenon");
  point.phenomenon = phenomenon ? phenomenon.slice(0, 120) : null;

  if (!hasWeatherMeasurement(point)) {
    throw new WeatherParseError("Võru observation contained no weather measurements");
  }

  return { point, updatedAt: updatedAt.toISOString() };
}
