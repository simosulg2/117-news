import type { RiigikoguAgenda, RiigikoguSitting } from "@/lib/riigikogu-types";

const tallinnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Tallinn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type AgendaSelection = {
  mode: "today" | "next" | "empty";
  sittings: RiigikoguSitting[];
};

function tallinnDateKey(value: Date | string): string | null {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const parts = tallinnDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function selectAgendaSittings(agenda: RiigikoguAgenda | null, now: Date): AgendaSelection {
  const today = tallinnDateKey(now);
  if (!agenda || !today) return { mode: "empty", sittings: [] };

  const dated = agenda.sittings
    .map((sitting) => ({ sitting, dateKey: tallinnDateKey(sitting.startsAt) }))
    .filter((item): item is { sitting: RiigikoguSitting; dateKey: string } => item.dateKey !== null)
    .sort((left, right) => left.sitting.startsAt.localeCompare(right.sitting.startsAt));
  const todaysSittings = dated.filter((item) => item.dateKey === today).map((item) => item.sitting);
  if (todaysSittings.length > 0) return { mode: "today", sittings: todaysSittings };

  const nextDate = dated.find((item) => item.dateKey > today)?.dateKey;
  if (!nextDate) return { mode: "empty", sittings: [] };
  return {
    mode: "next",
    sittings: dated.filter((item) => item.dateKey === nextDate).map((item) => item.sitting),
  };
}
