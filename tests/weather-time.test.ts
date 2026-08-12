import assert from "node:assert/strict";
import test from "node:test";

import { resolveTallinnLocalTime } from "../lib/weather-time.ts";

test("resolves Tallinn summer and winter wall times to UTC", () => {
  const summer = resolveTallinnLocalTime("2026-08-12T03:20");
  const winter = resolveTallinnLocalTime("2026-01-12T03:20");

  assert.equal(summer.status, "valid");
  assert.equal(summer.timestamp, Date.parse("2026-08-12T00:20:00.000Z"));
  assert.equal(summer.status === "valid" && summer.ambiguous, false);
  assert.equal(winter.status, "valid");
  assert.equal(winter.timestamp, Date.parse("2026-01-12T01:20:00.000Z"));
});

test("rejects the skipped Tallinn spring-forward hour", () => {
  assert.deepEqual(resolveTallinnLocalTime("2026-03-29T03:30"), {
    status: "nonexistent",
    timestamp: null,
    alternatives: [],
  });
});

test("reports both occurrences of Tallinn's repeated autumn hour", () => {
  const result = resolveTallinnLocalTime("2026-10-25T03:30");

  assert.equal(result.status, "valid");
  assert.equal(result.status === "valid" && result.ambiguous, true);
  assert.deepEqual(result.alternatives, [
    Date.parse("2026-10-25T00:30:00.000Z"),
    Date.parse("2026-10-25T01:30:00.000Z"),
  ]);
  assert.equal(result.timestamp, Date.parse("2026-10-25T00:30:00.000Z"));
});

test("rejects malformed and impossible local dates", () => {
  assert.equal(resolveTallinnLocalTime("not-a-date").status, "invalid");
  assert.equal(resolveTallinnLocalTime("2026-02-30T12:00").status, "invalid");
});
