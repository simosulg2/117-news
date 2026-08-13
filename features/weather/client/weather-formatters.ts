import { TALLINN_TIME_ZONE } from "@/lib/weather-time";
import type { WeatherPoint } from "@/lib/weather-types";

export const clockFormatter = new Intl.DateTimeFormat("et-EE", {
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: TALLINN_TIME_ZONE,
});

export const dateTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TALLINN_TIME_ZONE,
});

export const shortTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TALLINN_TIME_ZONE,
});

export const axisTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TALLINN_TIME_ZONE,
});

export const dateInputFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: TALLINN_TIME_ZONE,
});

const dateTimeInputFormatter = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TALLINN_TIME_ZONE,
});

export const decimalFormatter = new Intl.NumberFormat("et-EE", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

const PHENOMENON_LABELS_ET: Readonly<Record<string, string>> = {
  clear: "Selge",
  "few clouds": "Vähene pilvisus",
  "variable clouds": "Poolpilves",
  "cloudy with clear spells": "Peamiselt pilves",
  overcast: "Pilves",
  "light snow shower": "Nõrk hooglumi",
  "moderate snow shower": "Mõõdukas hooglumi",
  "heavy snow shower": "Tugev hooglumi",
  "light shower": "Nõrk hoovihm",
  "moderate shower": "Mõõdukas hoovihm",
  "heavy shower": "Tugev hoovihm",
  "light rain": "Nõrk vihm",
  "moderate rain": "Mõõdukas vihm",
  "heavy rain": "Tugev vihm",
  glaze: "Jäide",
  "light sleet": "Nõrk lörtsisadu",
  "moderate sleet": "Mõõdukas lörtsisadu",
  "light snowfall": "Nõrk lumesadu",
  "moderate snowfall": "Mõõdukas lumesadu",
  "heavy snowfall": "Tugev lumesadu",
  hail: "Rahe",
  mist: "Uduvine",
  fog: "Udu",
};

export function displayPhenomenon(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return PHENOMENON_LABELS_ET[trimmed.toLocaleLowerCase("en-US")] ?? trimmed;
}

export function formatNumber(value: number | null | undefined, unit = "", digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const formatted = new Intl.NumberFormat("et-EE", { maximumFractionDigits: digits }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function toTallinnDateTimeInput(value: number): string {
  return dateTimeInputFormatter.format(new Date(value)).replace(" ", "T");
}

export function sourceLabel(kind: WeatherPoint["kind"]): string {
  return kind === "observed" ? "Mõõdetud" : "Mudel";
}

export function weatherSourceLabel(source: WeatherPoint["source"]): string {
  return source === "open_meteo" ? "Open-Meteo" : "Ilmateenistus";
}
