import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  NORSTAT_RATINGS_DATA_URL,
  NorstatRatingsParseError,
  parseNorstatRatings,
} from "../lib/norstat-ratings.ts";

const fixtureUrl = new URL("./fixtures/norstat-ratings-v3.json", import.meta.url);

function fixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(fixtureUrl, "utf8")) as Record<string, unknown>;
}

test("decodes the latest and previous nationwide four-week waves", () => {
  const poll = parseNorstatRatings(fixture());

  assert.equal(poll.source.dataUrl, NORSTAT_RATINGS_DATA_URL);
  assert.equal(poll.source.schemaVersion, 3);
  assert.deepEqual(poll.wave, {
    id: "378-381",
    kind: "rolling-four-week",
    startDate: "2026-07-13",
    endDate: "2026-08-09",
  });
  assert.deepEqual(poll.previousWave, {
    id: "377-380",
    kind: "rolling-four-week",
    startDate: "2026-07-06",
    endDate: "2026-08-02",
  });
  assert.deepEqual(poll.sample, {
    total: 4000,
    voters: 2674,
    effectiveTotal: 3873,
    effectiveVoters: 2595,
  });
  assert.equal(poll.withoutPartyPreferencePct, 33.4);

  assert.deepEqual(
    poll.parties.map(({ id, supportPct, previousSupportPct, changePctPoints }) => ({
      id,
      supportPct,
      previousSupportPct,
      changePctPoints,
    })),
    [
      { id: "isamaa", supportPct: 26.4, previousSupportPct: 26, changePctPoints: 0.4 },
      { id: "kesk", supportPct: 21.9, previousSupportPct: 22.1, changePctPoints: -0.2 },
      { id: "parempoolsed", supportPct: 5.4, previousSupportPct: 6.1, changePctPoints: -0.7 },
      { id: "source-uus-tulevik", supportPct: 2, previousSupportPct: null, changePctPoints: null },
    ],
  );
});

test("assigns display metadata without changing the source name", () => {
  const poll = parseNorstatRatings(fixture());
  const known = poll.parties.find((party) => party.id === "parempoolsed");
  const unknown = poll.parties.find((party) => party.id === "source-uus-tulevik");

  assert.deepEqual(known, {
    id: "parempoolsed",
    name: "Erakond Parempoolsed",
    shortName: "Parempoolsed",
    sourceName: "Erakond Parempoolsed",
    color: "#7C3AED",
    kind: "party",
    supportPct: 5.4,
    previousSupportPct: 6.1,
    changePctPoints: -0.7,
  });
  assert.equal(unknown?.sourceName, "Uus Tulevik");
  assert.equal(unknown?.name, "Uus Tulevik");
  assert.equal(unknown?.color, "#64748B");
});

test("returns null comparisons when there is no preceding four-week wave", () => {
  const input = fixture();
  const axes = input.a as unknown[][];
  (axes[1][1] as unknown[]).splice(0, 1);
  const blocks = input.b as unknown[][];
  const fourWeekBlock = blocks[1];
  fourWeekBlock[2] = [[264], [219], [54], [20]];
  fourWeekBlock[3] = [334];
  fourWeekBlock[4] = [[4000], [2674], [3873], [2595]];

  const poll = parseNorstatRatings(input);
  assert.equal(poll.previousWave, null);
  assert.equal(poll.parties.every((party) => party.previousSupportPct === null), true);
  assert.equal(poll.parties.every((party) => party.changePctPoints === null), true);
});

test("rejects unknown schema versions", () => {
  const input = fixture();
  input.v = 4;
  assert.throws(() => parseNorstatRatings(input), NorstatRatingsParseError);
});

test("rejects a row whose length differs from the four-week axis", () => {
  const input = fixture();
  const blocks = input.b as unknown[][];
  (blocks[1][2] as unknown[][])[0] = [264];
  assert.throws(
    () => parseNorstatRatings(input),
    /length does not match its axis/,
  );
});

test("rejects r[1] when it does not identify a four-week block", () => {
  const input = fixture();
  input.r = [0, 0];
  assert.throws(
    () => parseNorstatRatings(input),
    /r\[1\] must point to the four-week axis/,
  );
});

test("rejects different source names that collide after ID normalization", () => {
  const input = fixture();
  (input.p as string[]).push("Uus-Tulevik");
  const blocks = input.b as unknown[][];
  const fourWeekBlock = blocks[1];
  (fourWeekBlock[1] as number[]).push(4);
  (fourWeekBlock[2] as unknown[][]).push([10, 10]);

  assert.throws(
    () => parseNorstatRatings(input),
    /multiple source parties normalize to the ID source-uus-tulevik/,
  );
});
