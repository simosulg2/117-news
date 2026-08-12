import assert from "node:assert/strict";
import test from "node:test";

import { nearestTimestamp, stepTimestamp, uniqueSortedTimestamps } from "../lib/weather-chart.ts";

test("uniqueSortedTimestamps removes invalid values and sorts the result", () => {
  assert.deepEqual(uniqueSortedTimestamps([30, 10, Number.NaN, 20, 10]), [10, 20, 30]);
});

test("nearestTimestamp selects the closest real sample and prefers the earlier tie", () => {
  const timestamps = [10, 20, 40];
  assert.equal(nearestTimestamp(timestamps, 31), 40);
  assert.equal(nearestTimestamp(timestamps, 30), 20);
  assert.equal(nearestTimestamp(timestamps, -10), 10);
  assert.equal(nearestTimestamp([], 20), null);
  assert.equal(nearestTimestamp(timestamps, 100, 20), null);
});

test("stepTimestamp moves between real samples and clamps at the ends", () => {
  const timestamps = [10, 20, 40];
  assert.equal(stepTimestamp(timestamps, 20, "previous"), 10);
  assert.equal(stepTimestamp(timestamps, 20, "next"), 40);
  assert.equal(stepTimestamp(timestamps, 10, "previous"), 10);
  assert.equal(stepTimestamp(timestamps, 40, "next"), 40);
  assert.equal(stepTimestamp(timestamps, null, "first"), 10);
  assert.equal(stepTimestamp(timestamps, null, "last"), 40);
});
