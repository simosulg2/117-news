import type {
  WeatherDailySummary,
  WeatherPoint,
  WeatherPointKind,
} from "./weather-types.ts";

const OFFICIAL_HISTORY_ELEMENTS = new Set([
  "PA0",
  "PR1H",
  "RH",
  "TA",
  "WD10M",
  "WS10M",
  "WSX1H",
]);

const TALLINN_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Tallinn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export class WeatherParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherParseError";
  }
}

type ParsedCurrentObservation = {
  point: WeatherPoint;
  updatedAt: string;
};

type ParsedOfficialHistory = {
  points: WeatherPoint[];
  updatedAt: string | null;
};

type ParsedOpenMeteo = {
  modeledHistory: WeatherPoint[];
  forecast: WeatherPoint[];
  updatedAt: string;
};

export type UtcMonthRange = {
  year: number;
  month: number;
  firstDay: number;
  lastDay: number;
};

function weatherPoint(
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

function hasWeatherMeasurement(point: WeatherPoint): boolean {
  return [
    point.temperatureC,
    point.relativeHumidityPct,
    point.precipitationMm,
    point.pressureHpa,
    point.windSpeedMs,
    point.windGustMs,
  ].some((value) => value !== null);
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

  const point = weatherPoint(
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
      ?? weatherPoint(time, "observed", "environment_agency_history");
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
    const point = weatherPoint(date.toISOString(), "modeled", "open_meteo");
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

export function utcMonthRanges(start: Date, end: Date): UtcMonthRange[] {
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay) || startDay > endDay) return [];

  const ranges: UtcMonthRange[] = [];
  let year = start.getUTCFullYear();
  let monthIndex = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonthIndex = end.getUTCMonth();

  while (year < endYear || (year === endYear && monthIndex <= endMonthIndex)) {
    const isFirst = year === start.getUTCFullYear() && monthIndex === start.getUTCMonth();
    const isLast = year === endYear && monthIndex === endMonthIndex;
    ranges.push({
      year,
      month: monthIndex + 1,
      firstDay: isFirst ? start.getUTCDate() : 1,
      lastDay: isLast ? end.getUTCDate() : new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(),
    });
    monthIndex += 1;
    if (monthIndex === 12) {
      monthIndex = 0;
      year += 1;
    }
  }
  return ranges;
}
