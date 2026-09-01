import {
  SCHEDULE_CATEGORIES,
  SCHEDULE_DAYS,
  type RoutineItem,
  type ScheduleCategory,
  type ScheduleData,
  type ScheduleDay,
  type ScheduleEvent,
  type SchoolPeriod,
  type StudyPlan,
  type WeeklyMetric,
} from "../../../lib/schedule-types.ts";

export const SCHEDULE_DATA_LIMITS = {
  events: 512,
  schoolPeriods: 160,
  routines: 160,
  studyPlans: 64,
  metrics: 64,
  idLength: 64,
  labelLength: 160,
  detailLength: 500,
} as const;

export type ScheduleValidationIssue = { path: string; message: string };
export type ScheduleValidationResult =
  | { ok: true; data: ScheduleData }
  | { ok: false; issues: ScheduleValidationIssue[] };

const DAY_SET = new Set<number>(SCHEDULE_DAYS);
const CATEGORY_SET = new Set<string>(SCHEDULE_CATEGORIES);
const ROUTINE_SECTIONS = new Set(["morning", "evening", "fitness"]);
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9._:-]*[a-z0-9])?$/i;

export class ScheduleValidationError extends Error {
  readonly issues: ScheduleValidationIssue[];

  constructor(issue: ScheduleValidationIssue) {
    super(`Invalid schedule data at ${issue.path}: ${issue.message}`);
    this.name = "ScheduleValidationError";
    this.issues = [issue];
  }
}

function fail(path: string, message: string): never {
  throw new ScheduleValidationError({ path, message });
}

function record(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail(path, "must be an object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, "must be a plain object");
  }
  const allowed = new Set(allowedKeys);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, "is not allowed");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) fail(`${path}.${key}`, "must be a data property");
    result[key] = descriptor.value;
  }
  return result;
}

function text(
  value: unknown,
  path: string,
  maxLength: number = SCHEDULE_DATA_LIMITS.labelLength,
  allowEmpty: boolean = false,
): string {
  if (typeof value !== "string") return fail(path, "must be a string");
  const normalized = value.trim();
  if (!allowEmpty && normalized.length === 0) return fail(path, "must not be empty");
  if (normalized.length > maxLength) return fail(path, `must be at most ${maxLength} characters`);
  if (UNSAFE_TEXT.test(normalized)) return fail(path, "contains unsafe control characters");
  return normalized;
}

function id(value: unknown, path: string): string {
  const normalized = text(value, path, SCHEDULE_DATA_LIMITS.idLength);
  if (!ID_PATTERN.test(normalized)) return fail(path, "contains unsupported characters");
  return normalized;
}

function finiteNumber(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fail(path, "must be finite");
  if (value < minimum || value > maximum) return fail(path, `must be between ${minimum} and ${maximum}`);
  return value;
}

function integer(value: unknown, path: string, minimum: number, maximum: number): number {
  const parsed = finiteNumber(value, path, minimum, maximum);
  if (!Number.isInteger(parsed)) return fail(path, "must be an integer");
  return parsed;
}

function day(value: unknown, path: string): ScheduleDay {
  if (typeof value !== "number" || !DAY_SET.has(value)) return fail(path, "must be a day from 1 to 7");
  return value as ScheduleDay;
}

function category(value: unknown, path: string): ScheduleCategory {
  if (typeof value !== "string" || !CATEGORY_SET.has(value)) return fail(path, "is not a schedule category");
  return value as ScheduleCategory;
}

function list<T>(
  value: unknown,
  path: string,
  maximum: number,
  parseItem: (item: unknown, path: string) => T,
): T[] {
  if (!Array.isArray(value)) return fail(path, "must be an array");
  if (value.length > maximum) return fail(path, `must contain at most ${maximum} items`);
  return value.map((item, index) => parseItem(item, `${path}[${index}]`));
}

function event(value: unknown, path: string): ScheduleEvent {
  const item = record(value, path, [
    "id", "day", "startMinute", "endMinute", "title", "detail", "category", "flexible",
  ]);
  const startMinute = item.startMinute === null
    ? null
    : integer(item.startMinute, `${path}.startMinute`, 0, 1_439);
  const endMinute = item.endMinute === null
    ? null
    : integer(item.endMinute, `${path}.endMinute`, 0, 1_439);
  if ((startMinute === null) !== (endMinute === null)) {
    fail(path, "startMinute and endMinute must both be set or both be null");
  }
  if (startMinute !== null && startMinute === endMinute) {
    fail(path, "startMinute and endMinute must describe a non-zero window");
  }
  if (item.flexible !== undefined && typeof item.flexible !== "boolean") {
    fail(`${path}.flexible`, "must be a boolean");
  }
  if (startMinute === null && item.flexible !== true) {
    fail(`${path}.flexible`, "must be true when no time window is set");
  }
  return {
    id: id(item.id, `${path}.id`),
    day: day(item.day, `${path}.day`),
    startMinute,
    endMinute,
    title: text(item.title, `${path}.title`),
    ...(item.detail === undefined ? {} : {
      detail: text(item.detail, `${path}.detail`, SCHEDULE_DATA_LIMITS.detailLength, true),
    }),
    category: category(item.category, `${path}.category`),
    ...(item.flexible === undefined ? {} : { flexible: item.flexible }),
  };
}

function schoolPeriod(value: unknown, path: string): SchoolPeriod {
  const item = record(value, path, [
    "id", "day", "period", "timeWindow", "subjectEt", "note",
  ]);
  return {
    id: id(item.id, `${path}.id`),
    day: day(item.day, `${path}.day`),
    period: text(item.period, `${path}.period`, 32),
    timeWindow: text(item.timeWindow, `${path}.timeWindow`),
    subjectEt: text(item.subjectEt, `${path}.subjectEt`),
    note: text(item.note, `${path}.note`, SCHEDULE_DATA_LIMITS.detailLength, true),
  };
}

function routine(value: unknown, path: string): RoutineItem {
  const item = record(value, path, [
    "id", "section", "day", "timeWindow", "title", "details", "category",
  ]);
  if (typeof item.section !== "string" || !ROUTINE_SECTIONS.has(item.section)) {
    fail(`${path}.section`, "must be morning, evening, or fitness");
  }
  return {
    id: id(item.id, `${path}.id`),
    section: item.section as RoutineItem["section"],
    ...(item.day === undefined ? {} : { day: day(item.day, `${path}.day`) }),
    timeWindow: text(item.timeWindow, `${path}.timeWindow`),
    title: text(item.title, `${path}.title`),
    details: text(item.details, `${path}.details`, SCHEDULE_DATA_LIMITS.detailLength, true),
    category: category(item.category, `${path}.category`),
  };
}

function studyPlan(value: unknown, path: string): StudyPlan {
  const item = record(value, path, [
    "id", "day", "window", "maxHours", "actualHours", "focus", "difficulty", "status",
  ]);
  return {
    id: id(item.id, `${path}.id`),
    day: day(item.day, `${path}.day`),
    window: text(item.window, `${path}.window`),
    maxHours: finiteNumber(item.maxHours, `${path}.maxHours`, 0, 24),
    actualHours: item.actualHours === null
      ? null
      : finiteNumber(item.actualHours, `${path}.actualHours`, 0, 24),
    focus: text(item.focus, `${path}.focus`, SCHEDULE_DATA_LIMITS.detailLength, true),
    difficulty: text(item.difficulty, `${path}.difficulty`, 80, true),
    status: text(item.status, `${path}.status`, 80, true),
  };
}

function metric(value: unknown, path: string): WeeklyMetric {
  const item = record(value, path, ["id", "label", "hours", "detail"]);
  return {
    id: id(item.id, `${path}.id`),
    label: text(item.label, `${path}.label`),
    hours: finiteNumber(item.hours, `${path}.hours`, 0, 168),
    detail: text(item.detail, `${path}.detail`, SCHEDULE_DATA_LIMITS.detailLength, true),
  };
}

function uniqueIds(items: readonly { id: string }[], path: string): void {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.id)) fail(`${path}[${index}].id`, "must be unique within its collection");
    seen.add(item.id);
  }
}

export function parseScheduleData(input: unknown): ScheduleData {
  const value = record(input, "$", [
    "version", "title", "subtitle", "timeZone", "events", "schoolPeriods", "routines",
    "studyPlans", "metrics",
  ]);
  if (value.timeZone !== "Europe/Tallinn") fail("$.timeZone", "must be Europe/Tallinn");
  const data: ScheduleData = {
    version: text(value.version, "$.version", 32),
    title: text(value.title, "$.title"),
    subtitle: text(value.subtitle, "$.subtitle", 240, true),
    timeZone: "Europe/Tallinn",
    events: list(value.events, "$.events", SCHEDULE_DATA_LIMITS.events, event),
    schoolPeriods: list(
      value.schoolPeriods, "$.schoolPeriods", SCHEDULE_DATA_LIMITS.schoolPeriods, schoolPeriod,
    ),
    routines: list(value.routines, "$.routines", SCHEDULE_DATA_LIMITS.routines, routine),
    studyPlans: list(value.studyPlans, "$.studyPlans", SCHEDULE_DATA_LIMITS.studyPlans, studyPlan),
    metrics: list(value.metrics, "$.metrics", SCHEDULE_DATA_LIMITS.metrics, metric),
  };
  uniqueIds(data.events, "$.events");
  uniqueIds(data.schoolPeriods, "$.schoolPeriods");
  uniqueIds(data.routines, "$.routines");
  uniqueIds(data.studyPlans, "$.studyPlans");
  uniqueIds(data.metrics, "$.metrics");
  return data;
}

export function validateScheduleData(input: unknown): ScheduleValidationResult {
  try {
    return { ok: true, data: parseScheduleData(input) };
  } catch (error) {
    if (error instanceof ScheduleValidationError) return { ok: false, issues: error.issues };
    throw error;
  }
}
