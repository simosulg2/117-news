import type { ScheduleDay, SchoolPeriod } from "../../../lib/schedule-types.ts";

export type SchoolTimetableColumn = {
  period: string;
  timeWindow: string;
};

export type SchoolTimetableRow = {
  day: ScheduleDay;
  cells: SchoolPeriod[][];
};

export type SchoolTimetable = {
  columns: SchoolTimetableColumn[];
  rows: SchoolTimetableRow[];
  lunchWindows: string[];
};

const SCHOOL_WEEKDAYS: readonly ScheduleDay[] = [1, 2, 3, 4, 5];

function isLunch(period: SchoolPeriod): boolean {
  return period.period.trim().toLocaleLowerCase("et") === "lõunapaus";
}

function periodNumber(label: string): number {
  const match = label.match(/\d+/u);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function comparePeriods(left: SchoolPeriod, right: SchoolPeriod): number {
  return periodNumber(left.period) - periodNumber(right.period)
    || left.timeWindow.localeCompare(right.timeWindow, "et")
    || left.period.localeCompare(right.period, "et")
    || left.subjectEt.localeCompare(right.subjectEt, "et")
    || left.id.localeCompare(right.id, "et");
}

export function buildSchoolTimetable(periods: readonly SchoolPeriod[]): SchoolTimetable {
  const lessons = periods.filter((period) => !isLunch(period)).sort(comparePeriods);
  const populatedWeekendDays = ([6, 7] as const).filter((day) => (
    periods.some((period) => period.day === day)
  ));
  const displayedDays: readonly ScheduleDay[] = [...SCHOOL_WEEKDAYS, ...populatedWeekendDays];
  const columnByPeriod = new Map<string, SchoolTimetableColumn>();
  for (const lesson of lessons) {
    if (!columnByPeriod.has(lesson.period)) {
      columnByPeriod.set(lesson.period, {
        period: lesson.period,
        timeWindow: lesson.timeWindow,
      });
    }
  }
  const columns = [...columnByPeriod.values()].sort((left, right) => (
    periodNumber(left.period) - periodNumber(right.period)
    || left.timeWindow.localeCompare(right.timeWindow, "et")
    || left.period.localeCompare(right.period, "et")
  ));
  const rows = displayedDays.map((day) => ({
    day,
    cells: columns.map((column) => lessons.filter((lesson) => (
      lesson.day === day && lesson.period === column.period
    ))),
  }));
  const lunchWindows = [...new Set(
    periods.filter(isLunch).map((period) => period.timeWindow),
  )].sort((left, right) => left.localeCompare(right, "et"));

  return { columns, rows, lunchWindows };
}
