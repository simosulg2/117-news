import type {
  RoutineItem,
  ScheduleData,
  ScheduleDay,
  ScheduleEvent,
  SchoolPeriod,
} from "../../../lib/schedule-types.ts";

const LEGACY_SCHOOL_PREFIX = "school-";
const TIMETABLE_EVENT_PREFIX = "timetable:";
const ROUTINE_EVENT_PREFIX = "routine:";
const SCHOOL_WEEKDAYS: readonly ScheduleDay[] = [1, 2, 3, 4, 5];

export type ScheduleTimeWindow = Readonly<{
  startMinute: number;
  endMinute: number;
}>;

function parseTimeWindowParts(value: string): ScheduleTimeWindow | null {
  const match = /^\s*(\d{1,2})[.:](\d{2})\s*[\-–—]\s*(\d{1,2})[.:](\d{2})\s*$/u.exec(value);
  if (!match) return null;
  const startHour = Number(match[1]);
  const startMinutePart = Number(match[2]);
  const endHour = Number(match[3]);
  const endMinutePart = Number(match[4]);
  if (
    startHour > 23
    || endHour > 23
    || startMinutePart > 59
    || endMinutePart > 59
  ) return null;
  const startMinute = startHour * 60 + startMinutePart;
  const endMinute = endHour * 60 + endMinutePart;
  return startMinute === endMinute ? null : { startMinute, endMinute };
}

/** School periods must move forward within the same day. */
export function parseScheduleTimeWindow(value: string): ScheduleTimeWindow | null {
  const window = parseTimeWindowParts(value);
  return window && window.endMinute > window.startMinute ? window : null;
}

/** Routines may intentionally cross midnight. */
export function parseRoutineTimeWindow(value: string): ScheduleTimeWindow | null {
  return parseTimeWindowParts(value);
}

export function isDerivedSchoolPeriodEvent(event: Pick<ScheduleEvent, "id">): boolean {
  return event.id.startsWith(TIMETABLE_EVENT_PREFIX);
}

export function isDerivedRoutineEvent(event: Pick<ScheduleEvent, "id">): boolean {
  return event.id.startsWith(ROUTINE_EVENT_PREFIX);
}

function isManagedSchoolTimelineEvent(event: Pick<ScheduleEvent, "id">): boolean {
  return event.id.startsWith(LEGACY_SCHOOL_PREFIX)
    || isDerivedSchoolPeriodEvent(event);
}

function schoolEvent(period: SchoolPeriod): ScheduleEvent | null {
  const window = parseScheduleTimeWindow(period.timeWindow);
  if (!window) return null;
  const lunch = period.period.trim().toLocaleLowerCase("et") === "lõunapaus";
  const details = [lunch ? "" : period.period, period.note]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
  return {
    id: `${TIMETABLE_EVENT_PREFIX}${period.id}`,
    day: period.day,
    ...window,
    title: period.subjectEt,
    ...(details ? { detail: details } : {}),
    category: lunch ? "meals" : "school",
  };
}

export function deriveSchoolScheduleEvents(
  periods: readonly SchoolPeriod[],
): ScheduleEvent[] {
  return periods.flatMap((period) => {
    const event = schoolEvent(period);
    return event ? [event] : [];
  });
}

function routineDays(routine: RoutineItem): readonly ScheduleDay[] {
  if (routine.day !== undefined) return [routine.day];
  return routine.section === "fitness" ? [] : SCHOOL_WEEKDAYS;
}

export function deriveRoutineScheduleEvents(
  routines: readonly RoutineItem[],
): ScheduleEvent[] {
  return routines.flatMap((routine) => {
    const window = parseRoutineTimeWindow(routine.timeWindow);
    if (!window) return [];
    return routineDays(routine).map((day) => ({
      id: `${ROUTINE_EVENT_PREFIX}${routine.id}:${day}`,
      day,
      startMinute: window.startMinute,
      endMinute: window.endMinute,
      title: routine.title,
      ...(routine.details.trim() ? { detail: routine.details.trim() } : {}),
      category: routine.category,
    }));
  });
}

function normalizedTitle(value: string): string {
  return value.trim().toLocaleLowerCase("et");
}

function titleTokens(value: string): Set<string> {
  return new Set(normalizedTitle(value)
    .split(/[^\p{L}\p{N}]+/gu)
    .filter((token) => token.length >= 4));
}

function isLegacyRoutineDuplicate(
  event: ScheduleEvent,
  routineEvents: readonly ScheduleEvent[],
): boolean {
  if (
    event.startMinute === null
    || event.endMinute === null
    || event.endMinute <= event.startMinute
  ) return false;
  const overlapping = routineEvents
    .filter((routine) => (
      routine.day === event.day
      && routine.category === event.category
      && routine.startMinute !== null
      && routine.endMinute !== null
      && routine.endMinute > routine.startMinute
      && routine.endMinute > event.startMinute!
      && routine.startMinute < event.endMinute!
    ))
    .sort((left, right) => left.startMinute! - right.startMinute!);
  let coveredUntil = event.startMinute;
  const coveringTitles: string[] = [];
  for (const routine of overlapping) {
    if (routine.startMinute! > coveredUntil) break;
    if (routine.endMinute! <= coveredUntil) continue;
    coveredUntil = routine.endMinute!;
    coveringTitles.push(routine.title);
  }
  if (coveredUntil < event.endMinute) return false;

  const eventTokens = titleTokens(event.title);
  if (!eventTokens.size) return false;
  const routineTokens = new Set(coveringTitles.flatMap((title) => [...titleTokens(title)]));
  const matchingTokens = [...eventTokens].filter((token) => routineTokens.has(token)).length;
  return matchingTokens > 0 && matchingTokens / eventTokens.size >= 0.5;
}

function inferLegacyHiddenEventIds(data: ScheduleData): string[] {
  const routineEvents = deriveRoutineScheduleEvents(data.routines);
  return data.events
    .filter((event) => (
      isManagedSchoolTimelineEvent(event)
      || isDerivedRoutineEvent(event)
      || isLegacyRoutineDuplicate(event, routineEvents)
    ))
    .map((event) => event.id);
}

/**
 * Records the legacy cleanup decision once. Rows remain encrypted and intact,
 * while later routine edits cannot make a stale duplicate reappear or cause a
 * newly-created personal event to be inferred as a duplicate.
 */
export function canonicalizeScheduleData(data: ScheduleData): ScheduleData {
  if (data.editorVersion === 1) {
    return data.hiddenEventIds ? data : { ...data, hiddenEventIds: [] };
  }
  return {
    ...data,
    editorVersion: 1,
    hiddenEventIds: [...new Set([
      ...(data.hiddenEventIds ?? []),
      ...inferLegacyHiddenEventIds(data),
    ])],
  };
}

/** Returns user-managed rows using only the stable migration identities. */
export function personalScheduleEvents(data: ScheduleData): ScheduleEvent[] {
  const canonical = canonicalizeScheduleData(data);
  const hiddenIds = new Set(canonical.hiddenEventIds ?? []);
  return canonical.events.filter((event) => !hiddenIds.has(event.id));
}

/** Replaces only editable personal rows while retaining hidden legacy rows. */
export function mergePersonalScheduleEvents(
  data: ScheduleData,
  personalEvents: readonly ScheduleEvent[],
): ScheduleEvent[] {
  const canonical = canonicalizeScheduleData(data);
  const editableIds = new Set(personalScheduleEvents(canonical).map((event) => event.id));
  return [
    ...canonical.events.filter((event) => !editableIds.has(event.id)),
    ...personalEvents,
  ];
}

/** One timeline for Täna/Nädal, derived from the editable source sections. */
export function buildScheduleTimelineEvents(data: ScheduleData): ScheduleEvent[] {
  const canonical = canonicalizeScheduleData(data);
  return [
    ...personalScheduleEvents(canonical),
    ...deriveSchoolScheduleEvents(canonical.schoolPeriods),
    ...deriveRoutineScheduleEvents(canonical.routines),
  ];
}
