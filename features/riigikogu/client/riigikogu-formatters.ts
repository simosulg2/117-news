import type { RiigikoguVoteChoice } from "@/lib/riigikogu-types";

export const clockFormatter = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

export const dateFormatter = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn", day: "2-digit", month: "short", year: "numeric",
});

export const dateTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});

export const choiceLabels: Record<RiigikoguVoteChoice, string> = {
  "in-favor": "Poolt",
  against: "Vastu",
  neutral: "Erapooletu",
  "did-not-vote": "Ei hääletanud",
  absent: "Puudus",
  unknown: "Tundmatu valik",
};

export function codeLabel(value: string | null): string {
  if (!value) return "Staatus puudub";
  const text = value.replaceAll("_", " ").toLocaleLowerCase("et-EE");
  return text.charAt(0).toLocaleUpperCase("et-EE") + text.slice(1);
}

export function safeDate(value: string | null, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? "—" : (withTime ? dateTimeFormatter : dateFormatter).format(date);
}
