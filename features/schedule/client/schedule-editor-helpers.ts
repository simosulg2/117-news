import type {
  RoutineItem,
  ScheduleData,
  ScheduleDay,
  ScheduleEvent,
  SchoolPeriod,
  StudyPlan,
  WeeklyMetric,
} from "@/lib/schedule-types";

export type ScheduleEditorSection =
  | "general"
  | "events"
  | "school"
  | "routines"
  | "balance";

export function copyScheduleData(data: ScheduleData): ScheduleData {
  return {
    ...data,
    events: data.events.map((item) => ({ ...item })),
    schoolPeriods: data.schoolPeriods.map((item) => ({ ...item })),
    routines: data.routines.map((item) => ({ ...item })),
    studyPlans: data.studyPlans.map((item) => ({ ...item })),
    metrics: data.metrics.map((item) => ({ ...item })),
  };
}

function uniqueId(prefix: string, existingIds: readonly string[]): string {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const randomPart = typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const candidate = `${prefix}-${randomPart}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${prefix}-${Date.now().toString(36)}-${existing.size.toString(36)}`;
}

export function newScheduleEvent(existing: readonly ScheduleEvent[]): ScheduleEvent {
  return {
    id: uniqueId("event", existing.map((item) => item.id)),
    day: 1,
    startMinute: null,
    endMinute: null,
    title: "Uus sündmus",
    detail: "",
    category: "free",
    flexible: true,
  };
}

export function newSchoolPeriod(
  existing: readonly SchoolPeriod[],
  day: ScheduleDay,
): SchoolPeriod {
  return {
    id: uniqueId("school", existing.map((item) => item.id)),
    day,
    period: "1. tund",
    timeWindow: "08:30–09:45",
    subjectEt: "Uus tund",
    note: "",
  };
}

export function newRoutine(
  existing: readonly RoutineItem[],
  section: RoutineItem["section"],
): RoutineItem {
  return {
    id: uniqueId("routine", existing.map((item) => item.id)),
    section,
    ...(section === "fitness" ? { day: 1 as ScheduleDay } : {}),
    timeWindow: "",
    title: "Uus samm",
    details: "",
    category: section === "fitness" ? "exercise" : "routine",
  };
}

export function newStudyPlan(existing: readonly StudyPlan[]): StudyPlan {
  return {
    id: uniqueId("study", existing.map((item) => item.id)),
    day: 1,
    window: "",
    maxHours: 1,
    actualHours: null,
    focus: "",
    difficulty: "",
    status: "",
  };
}

export function newWeeklyMetric(existing: readonly WeeklyMetric[]): WeeklyMetric {
  return {
    id: uniqueId("metric", existing.map((item) => item.id)),
    label: "Uus mõõdik",
    hours: 0,
    detail: "",
  };
}

export function replaceItem<T>(items: readonly T[], index: number, next: T): T[] {
  return items.map((item, itemIndex) => itemIndex === index ? next : item);
}

export function removeItem<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || index >= items.length || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function moveItemAmongIds<T extends { id: string }>(
  items: readonly T[],
  id: string,
  visibleIds: readonly string[],
  direction: -1 | 1,
): T[] {
  const visibleIndex = visibleIds.indexOf(id);
  const targetId = visibleIds[visibleIndex + direction];
  if (visibleIndex < 0 || !targetId) return [...items];
  const index = items.findIndex((item) => item.id === id);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (index < 0 || targetIndex < 0) return [...items];
  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function minutesToTimeInput(minutes: number | null): string {
  if (minutes === null || !Number.isInteger(minutes) || minutes < 0 || minutes > 1_439) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeInputToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function sectionForValidationPath(path: string): ScheduleEditorSection {
  if (path.startsWith("$.events")) return "events";
  if (path.startsWith("$.schoolPeriods")) return "school";
  if (path.startsWith("$.routines")) return "routines";
  if (path.startsWith("$.studyPlans") || path.startsWith("$.metrics")) return "balance";
  return "general";
}
