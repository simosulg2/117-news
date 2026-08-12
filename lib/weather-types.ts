export const WEATHER_SOURCE_IDS = [
  "environment_agency_current",
  "environment_agency_history",
  "open_meteo",
] as const;

export type WeatherSourceId = (typeof WEATHER_SOURCE_IDS)[number];
export type WeatherPointKind = "observed" | "modeled";

export type WeatherPoint = {
  time: string;
  kind: WeatherPointKind;
  source: WeatherSourceId;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  relativeHumidityPct: number | null;
  cloudCoverPct: number | null;
  precipitationMm: number | null;
  pressureHpa: number | null;
  windSpeedMs: number | null;
  windGustMs: number | null;
  windDirectionDeg: number | null;
  weatherCode: number | null;
  phenomenon: string | null;
};

export type WeatherDailySummary = {
  date: string;
  kind: WeatherPointKind;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipitationMm: number | null;
  humidityAvgPct: number | null;
  windMaxMs: number | null;
};

export type WeatherSourceErrorCode = "timeout" | "unavailable" | "invalid_response";

export type WeatherSourceStatus = {
  id: WeatherSourceId;
  label: string;
  kind: "observation" | "model";
  status: "ok" | "error";
  updatedAt: string | null;
  errorCode?: WeatherSourceErrorCode;
};

export type WeatherAttribution = {
  source: WeatherSourceId;
  label: string;
  url: string;
  license: string | null;
};

export type WeatherResponse = {
  location: {
    name: "Võru";
    stationName: "Võru";
    stationWmoCode: "26249";
    latitude: number;
    longitude: number;
    timezone: "Europe/Tallinn";
  };
  current: WeatherPoint | null;
  history: {
    observed: WeatherPoint[];
    modeled: WeatherPoint[];
  };
  forecast: WeatherPoint[];
  daily: WeatherDailySummary[];
  sources: WeatherSourceStatus[];
  attributions: WeatherAttribution[];
  generatedAt: string;
};
