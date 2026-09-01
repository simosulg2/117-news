import type { ScheduleDay, ScheduleEvent } from "../../../lib/schedule-types.ts";
import { resolveTallinnLocalTime } from "../../../lib/weather-time.ts";

export const SCHEDULE_TIME_ZONE = "Europe/Tallinn" as const;

export type TallinnSchedulePosition = {
  day: ScheduleDay;
  minuteOfDay: number;
  localDate: string;
};

export type ScheduleOccurrence = {
  event: ScheduleEvent;
  startTimestamp: number;
  endTimestamp: number;
};

export type CurrentAndNextScheduleEvent = {
  current: ScheduleOccurrence | null;
  next: ScheduleOccurrence | null;
};

const DAY_MS = 86_400_000;
const TALLINN_PARTS = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: SCHEDULE_TIME_ZONE,
});

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function eventEndSortMinute(event: ScheduleEvent): number {
  if (event.startMinute === null || event.endMinute === null) return Number.POSITIVE_INFINITY;
  return event.endMinute <= event.startMinute ? event.endMinute + 1_440 : event.endMinute;
}

export function compareScheduleEvents(left: ScheduleEvent, right: ScheduleEvent): number {
  return left.day - right.day
    || (left.startMinute ?? Number.POSITIVE_INFINITY)
      - (right.startMinute ?? Number.POSITIVE_INFINITY)
    || eventEndSortMinute(left) - eventEndSortMinute(right)
    || compareText(left.title, right.title)
    || compareText(left.id, right.id);
}

export function sortScheduleEvents(events: readonly ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort(compareScheduleEvents);
}

export function groupScheduleEventsByDay(
  events: readonly ScheduleEvent[],
): Record<ScheduleDay, ScheduleEvent[]> {
  const grouped: Record<ScheduleDay, ScheduleEvent[]> = {
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [],
  };
  for (const event of sortScheduleEvents(events)) grouped[event.day].push(event);
  return grouped;
}

/** Whether a timed event has finished within its own displayed schedule day. */
export function isScheduleEventPast(event: ScheduleEvent, minuteOfDay: number): boolean {
  if (
    event.startMinute === null
    || event.endMinute === null
    || !Number.isInteger(minuteOfDay)
    || minuteOfDay < 0
    || minuteOfDay > 1_439
  ) return false;
  // A window whose end is not after its start intentionally crosses midnight.
  if (event.endMinute <= event.startMinute) return false;
  return event.endMinute <= minuteOfDay;
}

export function formatScheduleMinute(minute: number): string {
  if (!Number.isInteger(minute) || minute < 0 || minute > 1_439) {
    throw new RangeError("Schedule minute must be an integer from 0 to 1439");
  }
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

export function formatScheduleWindow(
  event: Pick<ScheduleEvent, "startMinute" | "endMinute">,
  flexibleLabel = "Paindlik",
): string {
  if (event.startMinute === null && event.endMinute === null) return flexibleLabel;
  if (event.startMinute === null || event.endMinute === null) return "—";
  return `${formatScheduleMinute(event.startMinute)}–${formatScheduleMinute(event.endMinute)}`;
}

function timestampOf(value: Date | number): number {
  const timestamp = typeof value === "number" ? value : value.getTime();
  if (!Number.isFinite(timestamp)) throw new RangeError("Schedule time must be a valid timestamp");
  return timestamp;
}

function tallinnParts(timestamp: number): Record<string, string> {
  return Object.fromEntries(
    TALLINN_PARTS.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
}

function dateStringFromOrdinal(ordinal: number): string {
  const date = new Date(ordinal);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function localDateOrdinal(timestamp: number): number {
  const parts = tallinnParts(timestamp);
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

function scheduleDayFromOrdinal(ordinal: number): ScheduleDay {
  const sundayBasedDay = new Date(ordinal).getUTCDay();
  return (sundayBasedDay === 0 ? 7 : sundayBasedDay) as ScheduleDay;
}

export function getTallinnSchedulePosition(at: Date | number): TallinnSchedulePosition {
  const timestamp = timestampOf(at);
  const parts = tallinnParts(timestamp);
  const ordinal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return {
    day: scheduleDayFromOrdinal(ordinal),
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
    localDate: dateStringFromOrdinal(ordinal),
  };
}

function resolveBoundary(dateOrdinal: number, minute: number): number | null {
  const date = dateStringFromOrdinal(dateOrdinal);
  const local = `${date}T${formatScheduleMinute(minute)}`;
  const result = resolveTallinnLocalTime(local);
  return result.status === "valid" ? result.timestamp : null;
}

function occurrenceForWeek(
  event: ScheduleEvent,
  mondayOrdinal: number,
  weekOffset: number,
): ScheduleOccurrence | null {
  if (event.startMinute === null || event.endMinute === null) return null;
  const startOrdinal = mondayOrdinal
    + (weekOffset * 7 + event.day - 1) * DAY_MS;
  const crossesMidnight = event.endMinute <= event.startMinute;
  const endOrdinal = startOrdinal + (crossesMidnight ? DAY_MS : 0);
  const startTimestamp = resolveBoundary(startOrdinal, event.startMinute);
  const endTimestamp = resolveBoundary(endOrdinal, event.endMinute);
  if (startTimestamp === null || endTimestamp === null || endTimestamp <= startTimestamp) return null;
  return { event, startTimestamp, endTimestamp };
}

function compareOccurrences(left: ScheduleOccurrence, right: ScheduleOccurrence): number {
  return left.startTimestamp - right.startTimestamp
    || left.endTimestamp - right.endTimestamp
    || compareScheduleEvents(left.event, right.event);
}

/**
 * Resolves weekly wall-clock events in Europe/Tallinn. Flexible events are not
 * candidates because they have no instant. A skipped DST wall time is skipped
 * for that week; an ambiguous autumn wall time uses the earlier occurrence.
 */
export function findCurrentAndNextScheduleEvent(
  events: readonly ScheduleEvent[],
  at: Date | number = Date.now(),
): CurrentAndNextScheduleEvent {
  const timestamp = timestampOf(at);
  const localOrdinal = localDateOrdinal(timestamp);
  const currentDay = scheduleDayFromOrdinal(localOrdinal);
  const mondayOrdinal = localOrdinal - (currentDay - 1) * DAY_MS;
  const occurrences: ScheduleOccurrence[] = [];
  for (const weekOffset of [-1, 0, 1]) {
    for (const event of events) {
      const occurrence = occurrenceForWeek(event, mondayOrdinal, weekOffset);
      if (occurrence) occurrences.push(occurrence);
    }
  }
  occurrences.sort(compareOccurrences);

  const active = occurrences
    .filter((occurrence) => occurrence.startTimestamp <= timestamp && timestamp < occurrence.endTimestamp)
    .sort((left, right) => right.startTimestamp - left.startTimestamp
      || left.endTimestamp - right.endTimestamp
      || compareScheduleEvents(left.event, right.event));
  const next = occurrences.find((occurrence) => occurrence.startTimestamp > timestamp) ?? null;
  return { current: active[0] ?? null, next };
}
