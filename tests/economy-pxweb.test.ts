import assert from "node:assert/strict";
import test from "node:test";

import { assertPxSchema, ParsedPxDataset } from "../features/economy/server/pxweb-dataset.ts";

function dataset(id = ["Period", "Indicator"], value: unknown = [1, 2, 3, 4]) {
  return {
    class: "dataset",
    label: "TEST",
    source: "Statistikaamet",
    id,
    size: [2, 2],
    dimension: {
      Period: { category: { index: { "2025Q1": 0, "2026Q1": 1 }, label: { "2025Q1": "2025 I", "2026Q1": "2026 I" } } },
      Indicator: { category: { index: { AVG: 0, MEDIAN: 1 }, label: { AVG: "Average, eurot", MEDIAN: "Median, eurot" } } },
    },
    value,
    status: { 3: "p" },
    extension: { px: { tableid: "TEST" } },
  };
}

test("parser addresses cells by dimension name regardless of dimension ordering", () => {
  const normal = new ParsedPxDataset(dataset());
  assert.equal(normal.cell({ Period: "2026Q1", Indicator: "AVG" }).value, 3);

  const reordered = dataset(["Indicator", "Period"], [1, 3, 2, 4]);
  reordered.size = [2, 2];
  const parsed = new ParsedPxDataset(reordered);
  assert.equal(parsed.cell({ Period: "2026Q1", Indicator: "AVG" }).value, 3);
  assert.equal(parsed.cell({ Period: "2026Q1", Indicator: "MEDIAN" }).status, "p");
});

test("sparse values preserve missing periods", () => {
  const parsed = new ParsedPxDataset(dataset(undefined, { 0: 1, 3: 4 }));
  assert.equal(parsed.cell({ Period: "2025Q1", Indicator: "MEDIAN" }).value, null);
  assert.equal(parsed.cell({ Period: "2026Q1", Indicator: "MEDIAN" }).value, 4);
});

test("schema assertion rejects unit-label drift", () => {
  const parsed = new ParsedPxDataset(dataset());
  assert.throws(
    () => assertPxSchema(parsed, ["Period", "Indicator"], { Indicator: { AVG: "Average, percent" } }),
    /category changed/,
  );
});

test("schema assertion accepts dimension reordering but rejects missing dimensions", () => {
  const parsed = new ParsedPxDataset(dataset());
  assert.doesNotThrow(() => assertPxSchema(parsed, ["Indicator", "Period"], {}));
  assert.throws(() => assertPxSchema(parsed, ["Period"], {}), /dimensions changed/);
});

test("parser rejects malformed or unsafe cell shapes", () => {
  assert.throws(() => new ParsedPxDataset({}), /JSON-stat2/);
  assert.throws(() => new ParsedPxDataset({ ...dataset(), size: [2, 3] }), /category count/);
  assert.throws(() => new ParsedPxDataset(dataset(undefined, [1, "bad", 3, 4])), /non-numeric/);
});
