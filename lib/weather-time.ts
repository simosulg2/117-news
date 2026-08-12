export const TALLINN_TIME_ZONE = "Europe/Tallinn";

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const OFFSET_PROBE_MS = 24 * 60 * 60 * 1_000;

const tallinnPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: TALLINN_TIME_ZONE,
});

export type TallinnLocalTimeResult =
  | { status: "invalid" | "nonexistent"; timestamp: null; alternatives: [] }
  | { status: "valid"; timestamp: number; alternatives: number[]; ambiguous: boolean };

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function formatterParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    tallinnPartsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
}

function tallinnOffsetMs(date: Date): number {
  const values = formatterParts(date);
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - date.getTime();
}

function validCalendarParts(parts: DateTimeParts): boolean {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  return date.getUTCFullYear() === parts.year
    && date.getUTCMonth() === parts.month - 1
    && date.getUTCDate() === parts.day
    && date.getUTCHours() === parts.hour
    && date.getUTCMinutes() === parts.minute;
}

function matchesTallinnWallClock(timestamp: number, parts: DateTimeParts): boolean {
  const values = formatterParts(new Date(timestamp));
  return Number(values.year) === parts.year
    && Number(values.month) === parts.month
    && Number(values.day) === parts.day
    && Number(values.hour) === parts.hour
    && Number(values.minute) === parts.minute;
}

/**
 * Resolves a timezone-free datetime-local value as Europe/Tallinn wall time.
 * A repeated autumn hour returns both UTC alternatives and selects the earlier
 * occurrence; a skipped spring hour is rejected instead of silently shifted.
 */
export function resolveTallinnLocalTime(value: string): TallinnLocalTimeResult {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return { status: "invalid", timestamp: null, alternatives: [] };

  const [, year, month, day, hour, minute] = match;
  const parts: DateTimeParts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
  if (!validCalendarParts(parts)) {
    return { status: "invalid", timestamp: null, alternatives: [] };
  }

  const wallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const offsets = new Set<number>();
  for (const dayOffset of [-2, -1, 0, 1, 2]) {
    offsets.add(tallinnOffsetMs(new Date(wallClockAsUtc + dayOffset * OFFSET_PROBE_MS)));
  }

  const alternatives = [...offsets]
    .map((offset) => wallClockAsUtc - offset)
    .filter((timestamp) => matchesTallinnWallClock(timestamp, parts))
    .sort((left, right) => left - right);

  if (alternatives.length === 0) {
    return { status: "nonexistent", timestamp: null, alternatives: [] };
  }

  return {
    status: "valid",
    timestamp: alternatives[0],
    alternatives,
    ambiguous: alternatives.length > 1,
  };
}
