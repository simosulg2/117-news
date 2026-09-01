import assert from "node:assert/strict";
import test from "node:test";

import {
  findCurrentAndNextScheduleEvent,
  formatScheduleMinute,
  formatScheduleWindow,
  getTallinnSchedulePosition,
  groupScheduleEventsByDay,
  isScheduleEventPast,
  sortScheduleEvents,
} from "../features/schedule/model/schedule-events.ts";
import {
  deriveStudyTotals,
  deriveWeeklyMetricPercentages,
} from "../features/schedule/model/schedule-metrics.ts";
import { buildSchoolTimetable } from "../features/schedule/model/school-timetable.ts";
import {
  buildScheduleTimelineEvents,
  canonicalizeScheduleData,
  deriveRoutineScheduleEvents,
  deriveSchoolScheduleEvents,
  mergePersonalScheduleEvents,
  parseScheduleTimeWindow,
  parseRoutineTimeWindow,
} from "../features/schedule/model/schedule-derived-events.ts";
import type {
  ScheduleData,
  ScheduleEvent,
  SchoolPeriod,
  StudyPlan,
  WeeklyMetric,
} from "../lib/schedule-types.ts";

test("parses Estonian timetable windows with colon or dot separators", () => {
  assert.deepEqual(parseScheduleTimeWindow("8.30–9.45"), {
    startMinute: 510,
    endMinute: 585,
  });
  assert.deepEqual(parseScheduleTimeWindow("11:50 - 13:05"), {
    startMinute: 710,
    endMinute: 785,
  });
  assert.equal(parseScheduleTimeWindow("09:45–08:30"), null);
  assert.deepEqual(parseRoutineTimeWindow("23:30–07:00"), {
    startMinute: 1_410,
    endMinute: 420,
  });
  assert.equal(parseScheduleTimeWindow("not a time"), null);
});

test("uses timetable cells as the single source for school timeline events", () => {
  const data: ScheduleData = {
    version: "test",
    title: "Plaan",
    subtitle: "",
    timeZone: "Europe/Tallinn",
    events: [
      event("school-old-copy", 1, 510, 585, { title: "Vana koopia", category: "school" }),
      event("music-practice", 1, 1_000, 1_060, { title: "Kitarr", category: "music" }),
    ],
    schoolPeriods: [{
      id: "monday-one",
      day: 1,
      period: "1. tund",
      timeWindow: "8.30–9.45",
      subjectEt: "Matemaatika",
      note: "218",
    }],
    routines: [],
    studyPlans: [],
    metrics: [],
  };

  const canonical = canonicalizeScheduleData(data);
  assert.deepEqual(canonical.events.map((item) => item.id), ["school-old-copy", "music-practice"]);
  assert.deepEqual(canonical.hiddenEventIds, ["school-old-copy"]);
  assert.deepEqual(deriveSchoolScheduleEvents(canonical.schoolPeriods), [{
    id: "timetable:monday-one",
    day: 1,
    startMinute: 510,
    endMinute: 585,
    title: "Matemaatika",
    detail: "1. tund · 218",
    category: "school",
  }]);
  assert.deepEqual(buildScheduleTimelineEvents(canonical).map((item) => item.id), [
    "music-practice",
    "timetable:monday-one",
  ]);
});

test("uses routines as the single source for repeated timeline events", () => {
  const routines = [{
    id: "wake-up",
    section: "morning" as const,
    timeWindow: "07:00–07:15",
    title: "Hommikune algus",
    details: "",
    category: "routine" as const,
  }, {
    id: "training",
    section: "fitness" as const,
    day: 3 as const,
    timeWindow: "17:00–18:00",
    title: "Liikumine",
    details: "Rahulikult",
    category: "exercise" as const,
  }];
  const derived = deriveRoutineScheduleEvents(routines);

  assert.equal(derived.length, 6);
  assert.deepEqual(derived.slice(0, 2).map((item) => [item.day, item.startMinute]), [
    [1, 420],
    [2, 420],
  ]);
  assert.deepEqual(derived.at(-1), {
    id: "routine:training:3",
    day: 3,
    startMinute: 1_020,
    endMinute: 1_080,
    title: "Liikumine",
    detail: "Rahulikult",
    category: "exercise",
  });
  assert.deepEqual(deriveRoutineScheduleEvents([{ ...routines[1], timeWindow: "Paindlik" }]), []);

  const data: ScheduleData = {
    version: "test",
    title: "Plaan",
    subtitle: "",
    timeZone: "Europe/Tallinn",
    events: [
      event("old-routine-copy", 1, 420, 435, { title: "Hommikune algus" }),
      event("same-title-other-time", 1, 500, 515, { title: "Hommikune algus" }),
      event("same-occurrence-other-category", 1, 420, 435, {
        title: "Hommikune algus",
        category: "free",
      }),
      event("standalone", 1, 600, 630, { title: "Eraldi tegevus" }),
    ],
    schoolPeriods: [],
    routines,
    studyPlans: [],
    metrics: [],
  };
  assert.deepEqual(canonicalizeScheduleData(data).events.map((item) => item.id), [
    "old-routine-copy",
    "same-title-other-time",
    "same-occurrence-other-category",
    "standalone",
  ]);
  assert.ok(!buildScheduleTimelineEvents(data).some((item) => item.id === "old-routine-copy"));
});

test("recognizes one legacy event covered by consecutive routine steps", () => {
  const routines = [{
    id: "prepare",
    section: "evening" as const,
    timeWindow: "22:30–22:45",
    title: "Homsed asjad valmis",
    details: "",
    category: "routine" as const,
  }, {
    id: "hygiene",
    section: "evening" as const,
    timeWindow: "22:45–23:00",
    title: "Õhtune hügieen",
    details: "",
    category: "routine" as const,
  }];
  const data: ScheduleData = {
    version: "test",
    title: "Plaan",
    subtitle: "",
    timeZone: "Europe/Tallinn",
    events: [event("legacy-evening", 1, 1_350, 1_380, {
      title: "Homsed asjad ja õhtune hügieen",
    })],
    schoolPeriods: [],
    routines,
    studyPlans: [],
    metrics: [],
  };
  assert.deepEqual(canonicalizeScheduleData(data).events, data.events);
  assert.ok(!buildScheduleTimelineEvents(data).some((item) => item.id === "legacy-evening"));
});

test("records routine duplicate identities once instead of re-inferring after edits", () => {
  const data: ScheduleData = {
    version: "test",
    title: "Plaan",
    subtitle: "",
    timeZone: "Europe/Tallinn",
    events: [event("legacy-morning", 1, 420, 435, { title: "Hommikune algus" })],
    schoolPeriods: [],
    routines: [{
      id: "morning",
      section: "morning",
      timeWindow: "07:00–07:15",
      title: "Hommikune algus",
      details: "",
      category: "routine",
    }],
    studyPlans: [],
    metrics: [],
  };
  const canonical = canonicalizeScheduleData(data);
  assert.deepEqual(canonical.hiddenEventIds, ["legacy-morning"]);

  const afterRoutineEdit: ScheduleData = {
    ...canonical,
    routines: [{ ...canonical.routines[0], title: "Uus hommik", timeWindow: "Paindlik" }],
  };
  assert.ok(!buildScheduleTimelineEvents(afterRoutineEdit).some((item) => item.id === "legacy-morning"));

  const legitimate = event("new-personal", 1, 420, 435, { title: "Uus hommik" });
  const withNewEvent = { ...afterRoutineEdit, events: [...afterRoutineEdit.events, legitimate] };
  assert.ok(buildScheduleTimelineEvents(withNewEvent).some((item) => item.id === "new-personal"));
});

test("keeps hidden legacy rows when personal activities are edited", () => {
  const data: ScheduleData = {
    version: "test",
    title: "Plaan",
    subtitle: "",
    timeZone: "Europe/Tallinn",
    events: [
      event("school-old-copy", 1, 510, 585, { category: "school" }),
      event("personal", 1, 600, 630, { title: "Eraldi tegevus" }),
    ],
    schoolPeriods: [],
    routines: [],
    studyPlans: [],
    metrics: [],
  };
  const updated = [{ ...data.events[1], day: 2 as const }];

  assert.deepEqual(mergePersonalScheduleEvents(data, updated), [
    data.events[0],
    updated[0],
  ]);
});

function event(
  id: string,
  day: ScheduleEvent["day"],
  startMinute: number | null,
  endMinute: number | null,
  overrides: Partial<ScheduleEvent> = {},
): ScheduleEvent {
  return {
    id,
    day,
    startMinute,
    endMinute,
    title: id,
    category: "routine",
    ...(startMinute === null ? { flexible: true } : {}),
    ...overrides,
  };
}

test("sorts and groups events deterministically without mutating input", () => {
  const input = [
    event("flex", 1, null, null),
    event("later", 1, 600, 660),
    event("earlier-b", 1, 480, 540, { title: "Beta" }),
    event("tuesday", 2, 420, 450),
    event("earlier-a", 1, 480, 540, { title: "Alpha" }),
  ];
  const sorted = sortScheduleEvents(input);
  const grouped = groupScheduleEventsByDay(input);

  assert.deepEqual(sorted.map((item) => item.id), [
    "earlier-a", "earlier-b", "later", "flex", "tuesday",
  ]);
  assert.deepEqual(input.map((item) => item.id), [
    "flex", "later", "earlier-b", "tuesday", "earlier-a",
  ]);
  assert.deepEqual(grouped[1].map((item) => item.id), [
    "earlier-a", "earlier-b", "later", "flex",
  ]);
  assert.deepEqual(grouped[7], []);
});

test("marks only completed same-day timed events as past", () => {
  assert.equal(isScheduleEventPast(event("ended", 1, 480, 540), 540), true);
  assert.equal(isScheduleEventPast(event("active", 1, 480, 540), 539), false);
  assert.equal(isScheduleEventPast(event("flexible", 1, null, null), 1_000), false);
  assert.equal(isScheduleEventPast(event("overnight", 1, 1_380, 420), 1_439), false);
  assert.equal(isScheduleEventPast(event("ended", 1, 480, 540), -1), false);
});

test("formats minute and event windows consistently", () => {
  assert.equal(formatScheduleMinute(0), "00:00");
  assert.equal(formatScheduleMinute(1_439), "23:59");
  assert.equal(formatScheduleWindow(event("overnight", 1, 1_410, 420)), "23:30–07:00");
  assert.equal(formatScheduleWindow(event("flex", 1, null, null)), "Paindlik");
  assert.equal(formatScheduleWindow(event("flex", 1, null, null), "Flexible"), "Flexible");
  assert.throws(() => formatScheduleMinute(1_440), RangeError);
  assert.throws(() => formatScheduleMinute(1.5), RangeError);
});

test("derives the Tallinn weekday and minute independently of host timezone", () => {
  assert.deepEqual(getTallinnSchedulePosition(Date.parse("2026-08-31T21:30:00Z")), {
    day: 2,
    minuteOfDay: 30,
    localDate: "2026-09-01",
  });
  assert.deepEqual(getTallinnSchedulePosition(Date.parse("2026-01-04T22:15:00Z")), {
    day: 1,
    minuteOfDay: 15,
    localDate: "2026-01-05",
  });
});

test("finds current and next events using Tallinn weekly recurrence", () => {
  const events = [
    event("morning", 1, 480, 540),
    event("midday", 1, 720, 750),
    event("flex", 1, null, null),
  ];
  const result = findCurrentAndNextScheduleEvent(
    events,
    Date.parse("2026-08-31T05:30:00Z"),
  );

  assert.equal(result.current?.event.id, "morning");
  assert.equal(result.current?.startTimestamp, Date.parse("2026-08-31T05:00:00Z"));
  assert.equal(result.next?.event.id, "midday");
  assert.equal(result.next?.startTimestamp, Date.parse("2026-08-31T09:00:00Z"));
});

test("carries a Sunday event across midnight into the next Tallinn week", () => {
  const events = [
    event("overnight", 7, 1_410, 30),
    event("monday", 1, 480, 540),
  ];
  const result = findCurrentAndNextScheduleEvent(
    events,
    Date.parse("2026-08-30T21:00:00Z"),
  );

  assert.equal(result.current?.event.id, "overnight");
  assert.equal(result.current?.startTimestamp, Date.parse("2026-08-30T20:30:00Z"));
  assert.equal(result.current?.endTimestamp, Date.parse("2026-08-30T21:30:00Z"));
  assert.equal(result.next?.event.id, "monday");
});

test("rolls the next event into the following week", () => {
  const result = findCurrentAndNextScheduleEvent(
    [event("weekly", 1, 480, 540)],
    Date.parse("2026-08-31T06:30:00Z"),
  );

  assert.equal(result.current, null);
  assert.equal(result.next?.startTimestamp, Date.parse("2026-09-07T05:00:00Z"));
});

test("skips a weekly start in Tallinn's nonexistent spring-forward hour", () => {
  const result = findCurrentAndNextScheduleEvent(
    [event("dst-window", 7, 210, 240)],
    Date.parse("2026-03-29T00:00:00Z"),
  );

  assert.equal(result.current, null);
  assert.equal(result.next?.startTimestamp, Date.parse("2026-04-05T00:30:00Z"));
});

test("uses deterministic latest-start precedence for overlapping events", () => {
  const result = findCurrentAndNextScheduleEvent([
    event("broad", 1, 480, 600),
    event("specific", 1, 510, 540),
  ], Date.parse("2026-08-31T05:45:00Z"));

  assert.equal(result.current?.event.id, "specific");
});

test("ignores flexible events and rejects invalid query timestamps", () => {
  assert.deepEqual(findCurrentAndNextScheduleEvent(
    [event("flex", 1, null, null)],
    Date.parse("2026-08-31T05:00:00Z"),
  ), { current: null, next: null });
  assert.throws(() => getTallinnSchedulePosition(Number.NaN), RangeError);
  assert.throws(() => findCurrentAndNextScheduleEvent([], new Date("invalid")), RangeError);
});

function studyPlan(id: string, maxHours: number, actualHours: number | null): StudyPlan {
  return {
    id,
    day: 1,
    window: "Window",
    maxHours,
    actualHours,
    focus: "",
    difficulty: "",
    status: "",
  };
}

test("derives study totals while distinguishing untracked plans", () => {
  assert.deepEqual(deriveStudyTotals([
    studyPlan("a", 1.25, 1),
    studyPlan("b", 1.75, 0.5),
    studyPlan("c", 0, null),
  ]), {
    maxHours: 3,
    actualHours: 1.5,
    remainingHours: 1.5,
    completionPercent: 50,
    trackedPlanCount: 2,
    totalPlanCount: 3,
  });
  assert.deepEqual(deriveStudyTotals([]), {
    maxHours: 0,
    actualHours: 0,
    remainingHours: 0,
    completionPercent: 0,
    trackedPlanCount: 0,
    totalPlanCount: 0,
  });
});

test("derives metric percentages from the displayed metric total", () => {
  const metrics: WeeklyMetric[] = [
    { id: "a", label: "A", hours: 10, detail: "" },
    { id: "b", label: "B", hours: 30, detail: "" },
  ];
  assert.deepEqual(deriveWeeklyMetricPercentages(metrics), {
    totalHours: 40,
    metrics: [
      { ...metrics[0], percentage: 25 },
      { ...metrics[1], percentage: 75 },
    ],
  });
  assert.deepEqual(deriveWeeklyMetricPercentages([
    { id: "zero", label: "Zero", hours: 0, detail: "" },
  ]).metrics[0].percentage, 0);
});

test("builds a weekday timetable with ordered lesson columns and a separate lunch break", () => {
  const periods: SchoolPeriod[] = [
    { id: "monday-three", day: 1, period: "3. tund", timeWindow: "11.50–13.05", subjectEt: "Aine C", note: "" },
    { id: "lunch", day: 1, period: "Lõunapaus", timeWindow: "11.10–11.50", subjectEt: "Lõuna", note: "" },
    { id: "monday-one", day: 1, period: "1. tund", timeWindow: "8.30–9.45", subjectEt: "Aine A", note: "" },
    { id: "tuesday-one", day: 2, period: "1. tund", timeWindow: "8.30–9.45", subjectEt: "Aine B", note: "" },
  ];

  const timetable = buildSchoolTimetable(periods);

  assert.deepEqual(timetable.columns.map((column) => column.period), ["1. tund", "3. tund"]);
  assert.deepEqual(timetable.lunchWindows, ["11.10–11.50"]);
  assert.equal(timetable.rows.length, 5);
  assert.deepEqual(timetable.rows[0].cells.map((cell) => cell.map((period) => period.id)), [
    ["monday-one"], ["monday-three"],
  ]);
  assert.deepEqual(timetable.rows[1].cells.map((cell) => cell.map((period) => period.id)), [
    ["tuesday-one"], [],
  ]);
  assert.deepEqual(periods.map((period) => period.id), [
    "monday-three", "lunch", "monday-one", "tuesday-one",
  ]);
});

test("adds only populated weekend rows to the school timetable", () => {
  const timetable = buildSchoolTimetable([{
    id: "saturday-one",
    day: 6,
    period: "1. tund",
    timeWindow: "09:00–10:00",
    subjectEt: "Konsultatsioon",
    note: "",
  }]);

  assert.deepEqual(timetable.rows.map((row) => row.day), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(timetable.rows.at(-1)?.cells[0].map((period) => period.id), ["saturday-one"]);
});
