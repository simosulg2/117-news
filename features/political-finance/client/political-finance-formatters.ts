import type { PoliticalFinancePeriod } from "../../../lib/political-finance-types";

export const clockFormatter = new Intl.DateTimeFormat("et-EE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

const moneyFormatter = new Intl.NumberFormat("et-EE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const preciseMoneyFormatter = new Intl.NumberFormat("et-EE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Tallinn",
});

const dateTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

export function money(value: number | null, precise = false): string {
  return value === null ? "—" : (precise ? preciseMoneyFormatter : moneyFormatter).format(value);
}

export function percentage(value: number | null): string {
  return value === null ? "—" : `${new Intl.NumberFormat("et-EE", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function periodLabel(period: PoliticalFinancePeriod): string {
  const [year, quarter] = period.split("-Q");
  return `${year} · ${quarter}. kvartal`;
}

export function dateLabel(value: string | null): string {
  if (!value) return "—";
  const time = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(time) ? dateFormatter.format(new Date(time)) : "—";
}

export function retrievedLabel(value: string): string {
  const time = Date.parse(value);
  return Number.isFinite(time) ? dateTimeFormatter.format(new Date(time)) : "—";
}
