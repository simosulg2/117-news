import assert from "node:assert/strict";
import test from "node:test";

import {
  parseScheduleData,
  SCHEDULE_DATA_LIMITS,
  ScheduleValidationError,
  validateScheduleData,
} from "../features/schedule/model/schedule-validation.ts";

function sampleEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "event-a",
    day: 1,
    startMinute: 480,
    endMinute: 540,
    title: "Session Alpha",
    category: "study",
    ...overrides,
  };
}

function sampleData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: "1",
    title: "Example schedule",
    subtitle: "Generic fixture",
    timeZone: "Europe/Tallinn",
    events: [sampleEvent()],
    schoolPeriods: [{
      id: "period-a",
      day: 1,
      period: "P1",
      timeWindow: "08:00–08:45",
      subjectEt: "Aine A",
      note: "",
    }],
    routines: [{
      id: "routine-a",
      section: "morning",
      timeWindow: "07:00",
      title: "Routine Alpha",
      details: "",
      category: "routine",
    }],
    studyPlans: [{
      id: "plan-a",
      day: 2,
      window: "16:00–17:00",
      maxHours: 1,
      actualHours: null,
      focus: "",
      difficulty: "",
      status: "",
    }],
    metrics: [{ id: "metric-a", label: "Metric Alpha", hours: 7.5, detail: "" }],
    ...overrides,
  };
}

test("parses a complete schedule into a normalized detached value", () => {
  const input = sampleData({
    title: "  Example schedule  ",
    events: [sampleEvent({ title: "  Session Alpha  ", detail: "  Notes  " })],
  });
  const parsed = parseScheduleData(input);

  assert.equal(parsed.title, "Example schedule");
  assert.equal(parsed.events[0].title, "Session Alpha");
  assert.equal(parsed.events[0].detail, "Notes");
  assert.notEqual(parsed.events, input.events);
  assert.equal(parsed.timeZone, "Europe/Tallinn");
});

test("accepts cross-midnight events and explicitly flexible events", () => {
  const parsed = parseScheduleData(sampleData({
    events: [
      sampleEvent({ id: "overnight", startMinute: 1_410, endMinute: 420, category: "sleep" }),
      sampleEvent({ id: "flex", startMinute: null, endMinute: null, flexible: true }),
    ],
  }));

  assert.equal(parsed.events[0].startMinute, 1_410);
  assert.equal(parsed.events[0].endMinute, 420);
  assert.equal(parsed.events[1].flexible, true);
});

test("rejects unknown fields and a non-Tallinn timezone", () => {
  const extra = validateScheduleData(sampleData({ unexpected: true }));
  const zone = validateScheduleData(sampleData({ timeZone: "UTC" }));

  assert.deepEqual(extra, {
    ok: false,
    issues: [{ path: "$.unexpected", message: "is not allowed" }],
  });
  assert.equal(zone.ok, false);
  assert.equal(zone.ok || zone.issues[0].path, "$.timeZone");
});

test("rejects partial, zero-length, and untimed non-flexible windows", () => {
  for (const event of [
    sampleEvent({ endMinute: null }),
    sampleEvent({ startMinute: 600, endMinute: 600 }),
    sampleEvent({ startMinute: null, endMinute: null }),
  ]) {
    assert.equal(validateScheduleData(sampleData({ events: [event] })).ok, false);
  }
});

test("rejects malformed or backwards timetable windows", () => {
  for (const timeWindow of ["", "08:30", "09:45–08:30", "25:00–26:00"]) {
    const result = validateScheduleData(sampleData({
      schoolPeriods: [{
        id: "period-a",
        day: 1,
        period: "1. tund",
        timeWindow,
        subjectEt: "Aine A",
        note: "",
      }],
    }));
    assert.equal(result.ok, false);
    assert.equal(result.ok || result.issues[0].path, "$.schoolPeriods[0].timeWindow");
  }
  const legacy = parseScheduleData(sampleData({
    schoolPeriods: [{
      id: "period-a",
      day: 1,
      period: "1. tund",
      timeWindow: "Hommikul",
      subjectEt: "Aine A",
      note: "",
    }],
  }));
  assert.equal(legacy.schoolPeriods[0].timeWindow, "Hommikul");
});

test("validates stable hidden event metadata", () => {
  const valid = validateScheduleData(sampleData({
    editorVersion: 1,
    hiddenEventIds: ["event-a"],
  }));
  assert.equal(valid.ok, true);

  for (const hiddenEventIds of [["missing"], ["event-a", "event-a"]]) {
    assert.equal(validateScheduleData(sampleData({
      editorVersion: 1,
      hiddenEventIds,
    })).ok, false);
  }
  assert.equal(validateScheduleData(sampleData({ editorVersion: 2 })).ok, false);
});

test("accepts free-text routines but rejects malformed clock ranges on save", () => {
  assert.equal(validateScheduleData(sampleData({
    routines: [{
      id: "routine-a",
      section: "evening",
      timeWindow: "Paindlik",
      title: "Rahulik õhtu",
      details: "",
      category: "routine",
    }],
  })).ok, true);
  for (const timeWindow of ["07:00–07:00", "25:00–26:00", "07:00–"]) {
    const result = validateScheduleData(sampleData({
      routines: [{
        id: "routine-a",
        section: "morning",
        timeWindow,
        title: "Hommik",
        details: "",
        category: "routine",
      }],
    }));
    assert.equal(result.ok, false);
    assert.equal(result.ok || result.issues[0].path, "$.routines[0].timeWindow");
  }
});

test("bounds arrays, text, ids, hours, minutes, and finite numbers", () => {
  assert.equal(validateScheduleData(sampleData({
    events: Array.from(
      { length: SCHEDULE_DATA_LIMITS.events + 1 },
      (_, index) => sampleEvent({ id: `event-${index}` }),
    ),
  })).ok, false);
  assert.equal(validateScheduleData(sampleData({ title: "x".repeat(161) })).ok, false);
  assert.equal(validateScheduleData(sampleData({ title: "line\nbreak" })).ok, false);
  assert.equal(validateScheduleData(sampleData({ events: [sampleEvent({ id: "bad id" })] })).ok, false);
  assert.equal(validateScheduleData(sampleData({ events: [sampleEvent({ startMinute: 1_440 })] })).ok, false);
  assert.equal(validateScheduleData(sampleData({
    metrics: [{ id: "metric-a", label: "Metric", hours: Number.NaN, detail: "" }],
  })).ok, false);
  assert.equal(validateScheduleData(sampleData({
    studyPlans: [{
      id: "plan-a", day: 1, window: "Any", maxHours: 25, actualHours: 0,
      focus: "", difficulty: "", status: "",
    }],
  })).ok, false);
});

test("rejects duplicate identifiers within each collection", () => {
  const result = validateScheduleData(sampleData({
    events: [sampleEvent(), sampleEvent({ title: "Session Beta" })],
  }));

  assert.equal(result.ok, false);
  assert.equal(result.ok || result.issues[0].path, "$.events[1].id");
});

test("parse errors expose a bounded structural path without input values", () => {
  assert.throws(
    () => parseScheduleData(sampleData({ events: "not-an-array" })),
    (error) => error instanceof ScheduleValidationError
      && error.issues[0].path === "$.events"
      && !error.message.includes("not-an-array"),
  );
});
