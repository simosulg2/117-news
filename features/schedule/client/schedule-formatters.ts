import type { ScheduleCategory, ScheduleDay } from "@/lib/schedule-types";

export const SCHEDULE_DAYS: ReadonlyArray<{
  value: ScheduleDay;
  label: string;
  shortLabel: string;
}> = [
  { value: 1, label: "Esmaspäev", shortLabel: "E" },
  { value: 2, label: "Teisipäev", shortLabel: "T" },
  { value: 3, label: "Kolmapäev", shortLabel: "K" },
  { value: 4, label: "Neljapäev", shortLabel: "N" },
  { value: 5, label: "Reede", shortLabel: "R" },
  { value: 6, label: "Laupäev", shortLabel: "L" },
  { value: 7, label: "Pühapäev", shortLabel: "P" },
];

export const CATEGORY_LABELS: Record<ScheduleCategory, string> = {
  school: "Kool",
  study: "Õppimine",
  music: "Muusika",
  exercise: "Liikumine",
  routine: "Rutiin",
  meals: "Söök",
  free: "Vaba aeg",
  sleep: "Uni",
  commute: "Sõit",
};

export const CATEGORY_ACCENTS: Record<ScheduleCategory, string> = {
  school: "border-l-[#245fae]",
  study: "border-l-[#7659c8]",
  music: "border-l-[#b54b7d]",
  exercise: "border-l-[#25836c]",
  routine: "border-l-[#b36b24]",
  meals: "border-l-[#a5831d]",
  free: "border-l-[#2d8399]",
  sleep: "border-l-[#4f5fae]",
  commute: "border-l-[#687d8d]",
};

const clockFormatter = new Intl.DateTimeFormat("et-EE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Tallinn",
});

const dateFormatter = new Intl.DateTimeFormat("et-EE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Tallinn",
});

const occurrenceFormatter = new Intl.DateTimeFormat("et-EE", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Tallinn",
});

const decimalFormatter = new Intl.NumberFormat("et-EE", {
  maximumFractionDigits: 1,
});

export function formatScheduleClock(now: Date): string {
  return clockFormatter.format(now);
}

export function formatScheduleDate(now: Date): string {
  return dateFormatter.format(now);
}

export function formatOccurrence(timestamp: number): string {
  return occurrenceFormatter.format(new Date(timestamp)).replace(",", "");
}

export function formatHours(hours: number): string {
  return `${decimalFormatter.format(hours)} h`;
}

export function formatUntil(timestamp: number, nowTimestamp: number): string {
  const minutes = Math.max(0, Math.ceil((timestamp - nowTimestamp) / 60_000));
  if (minutes < 60) return `${minutes} min pärast`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) {
    return remainder ? `${hours} h ${remainder} min pärast` : `${hours} h pärast`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days} p ${remainingHours} h pärast` : `${days} p pärast`;
}
