import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateHighestAverages,
  projectRiigikoguSeats,
  type PartyRating,
} from "../lib/seat-projection.ts";

function seatsById(result: ReturnType<typeof projectRiigikoguSeats>): Record<string, number> {
  return Object.fromEntries(result.projection.map((party) => [party.id, party.seats]));
}

test("reproduces the published ERR/Norstat national projection", () => {
  const result = projectRiigikoguSeats([
    { id: "isamaa", name: "Isamaa", support: 25.6 },
    { id: "centre", name: "Centre", support: 21.9 },
    { id: "sde", name: "SDE", support: 15 },
    { id: "reform", name: "Reform", support: 13.1 },
    { id: "ekre", name: "EKRE", support: 12.9 },
    { id: "parempoolsed", name: "Parempoolsed", support: 6.2 },
  ]);

  assert.deepEqual(seatsById(result), {
    isamaa: 29,
    centre: 24,
    sde: 16,
    reform: 13,
    ekre: 13,
    parempoolsed: 6,
  });
  assert.equal(result.projection.reduce((sum, party) => sum + party.seats, 0), 101);
  assert.deepEqual(result.excluded, []);
  assert.deepEqual(result.assumptions, {
    method: "highest-averages",
    seats: 101,
    threshold: 5,
    thresholdInclusive: true,
    exponent: 0.9,
    tieBreaker: "party-id-ascending",
  });
});

test("applies the five-percent threshold inclusively", () => {
  const result = projectRiigikoguSeats([
    { id: "at-threshold", name: "Exactly five", support: 5 },
    { id: "below", name: "Just below", support: 4.999 },
    { id: "leader", name: "Leader", support: 45 },
  ]);

  assert.ok(result.projection.some((party) => party.id === "at-threshold"));
  assert.ok(result.projection.every((party) => party.id !== "below"));
  assert.deepEqual(result.excluded, [{
    id: "below",
    name: "Just below",
    support: 4.999,
    reason: "below-threshold",
  }]);
  assert.equal(result.projection.reduce((sum, party) => sum + party.seats, 0), 101);
});

test("supports classic D'Hondt through the generic allocator defaults", () => {
  const result = allocateHighestAverages([
    { id: "a", name: "Party A", support: 3_000 },
    { id: "b", name: "Party B", support: 2_700 },
  ], { seats: 3 });

  assert.deepEqual(seatsById(result), { a: 2, b: 1 });
  assert.equal(result.assumptions.threshold, 0);
  assert.equal(result.assumptions.exponent, 1);
});

test("resolves exact quotient ties by party ID independent of input order", () => {
  const ascending: PartyRating[] = [
    { id: "alpha", name: "Alpha", support: 10 },
    { id: "beta", name: "Beta", support: 10 },
  ];
  const descending = [...ascending].reverse();

  const first = allocateHighestAverages(ascending, { seats: 1 });
  const second = allocateHighestAverages(descending, { seats: 1 });

  assert.deepEqual(first, second);
  assert.deepEqual(seatsById(first), { alpha: 1, beta: 0 });
});

test("does not mutate ratings or their party objects", () => {
  const ratings = Object.freeze([
    Object.freeze({ id: "a", name: "Party A", support: 60 }),
    Object.freeze({ id: "b", name: "Party B", support: 40 }),
  ]);
  const before = structuredClone(ratings);

  allocateHighestAverages(ratings, { seats: 7, exponent: 0.9 });

  assert.deepEqual(ratings, before);
});

test("is invariant when every support value is scaled equally", () => {
  const percentages = [
    { id: "a", name: "Party A", support: 60 },
    { id: "b", name: "Party B", support: 30 },
    { id: "c", name: "Party C", support: 10 },
  ];
  const votes = percentages.map((party) => ({ ...party, support: party.support * 1_000 }));

  const fromPercentages = allocateHighestAverages(percentages, { seats: 17, exponent: 0.9 });
  const fromVotes = allocateHighestAverages(votes, { seats: 17, exponent: 0.9 });

  assert.deepEqual(seatsById(fromPercentages), seatsById(fromVotes));
});

test("returns a valid zero-seat projection", () => {
  const result = allocateHighestAverages([
    { id: "a", name: "Party A", support: 10 },
  ], { seats: 0, threshold: 20, exponent: 0.9 });

  assert.deepEqual(result.projection, []);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.assumptions.seats, 0);
});

test("rejects duplicate party IDs", () => {
  assert.throws(() => allocateHighestAverages([
    { id: "same", name: "First", support: 40 },
    { id: "same", name: "Second", support: 30 },
  ], { seats: 10 }), /duplicate party id: same/);
});

test("rejects non-finite and negative support", () => {
  for (const support of [Number.NaN, Number.POSITIVE_INFINITY, -0.01]) {
    assert.throws(() => allocateHighestAverages([
      { id: "invalid", name: "Invalid", support },
    ], { seats: 1 }), /support for party invalid must be finite and non-negative/);
  }
});

test("validates allocator options", () => {
  const ratings = [{ id: "a", name: "Party A", support: 10 }];

  assert.throws(() => allocateHighestAverages(ratings, { seats: 1.5 }), /seats/);
  assert.throws(() => allocateHighestAverages(ratings, { seats: -1 }), /seats/);
  assert.throws(() => allocateHighestAverages(ratings, { seats: 1, threshold: Number.NaN }), /threshold/);
  assert.throws(() => allocateHighestAverages(ratings, { seats: 1, threshold: -1 }), /threshold/);
  assert.throws(() => allocateHighestAverages(ratings, { seats: 1, exponent: 0 }), /exponent/);
  assert.throws(() => allocateHighestAverages(ratings, { seats: 1, exponent: Number.POSITIVE_INFINITY }), /exponent/);
});

test("fails explicitly when no party can receive a positive seat allocation", () => {
  assert.throws(() => projectRiigikoguSeats([
    { id: "small", name: "Small", support: 4.9 },
  ]), /no party meets the threshold/);
});
