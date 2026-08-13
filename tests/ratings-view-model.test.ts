import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRatingsViewModel,
  calculateRatingsProjection,
  validCoalitionSelection,
} from "../features/ratings/model/ratings-view-model.ts";
import type { RatingsParty } from "../lib/ratings-types.ts";
import type { SeatProjectionResult } from "../lib/seat-projection.ts";

function party(
  id: string,
  supportPct: number | null,
  options: Partial<RatingsParty> = {},
): RatingsParty {
  return {
    id,
    name: id.toUpperCase(),
    shortName: id,
    sourceName: id,
    color: "#123456",
    kind: "party",
    supportPct,
    previousSupportPct: supportPct,
    changePctPoints: 0,
    ...options,
  };
}

const projection: SeatProjectionResult = {
  projection: [
    { id: "reform", name: "Reform", support: 20, seats: 30 },
    { id: "isamaa", name: "Isamaa", support: 30, seats: 35 },
    { id: "sde", name: "SDE", support: 15, seats: 20 },
    { id: "ekre", name: "EKRE", support: 12, seats: 16 },
  ],
  excluded: [],
  assumptions: {
    method: "highest-averages",
    seats: 101,
    threshold: 5,
    thresholdInclusive: true,
    exponent: 0.9,
    tieBreaker: "party-id-ascending",
  },
};

test("projects only named parties and includes exactly five percent", () => {
  const result = calculateRatingsProjection([
    party("eligible", 5),
    party("below", 4.9),
    party("other", 60, { kind: "other" }),
    party("independent", 20, { kind: "independent" }),
  ]);

  assert.ok(result);
  assert.deepEqual(result.projection.map(({ id, seats }) => ({ id, seats })), [
    { id: "eligible", seats: 101 },
  ]);
  assert.deepEqual(result.excluded.map((entry) => entry.id), ["below"]);
});

test("returns null when no eligible party reaches the threshold", () => {
  assert.equal(calculateRatingsProjection([
    party("below", 4.9),
    party("other", 60, { kind: "other" }),
  ]), null);
});

test("orders the chamber by seats and groups selected coalition parties on the left", () => {
  const parties = [
    party("isamaa", 30),
    party("reform", 20),
    party("sde", 15),
    party("ekre", 12),
  ];
  const view = buildRatingsViewModel(parties, projection, new Set(["reform", "ekre"]));

  assert.deepEqual(view.hemicycleParties.map((entry) => entry.id), [
    "isamaa", "reform", "sde", "ekre",
  ]);
  assert.deepEqual(view.chamberParties.map((entry) => entry.id), [
    "reform", "ekre", "isamaa", "sde",
  ]);
  assert.equal(view.selectedCoalitionSeats, 46);
  assert.equal(view.selectedCoalitionCount, 2);
});

test("derives government totals, table groups, and the displayed threshold waste", () => {
  const parties = [
    party("isamaa", 30),
    party("reform", 20),
    party("sde", 15),
    party("ekre", 12),
    party("eesti200", 4),
    party("small", 3),
    party("other", 2, { kind: "other" }),
    party("independent", 1, { kind: "independent" }),
  ];
  const view = buildRatingsViewModel(parties, projection, new Set());

  assert.equal(view.governmentSeats, 30);
  assert.equal(view.oppositionSeats, 71);
  assert.equal(view.eesti200Support, 4);
  assert.deepEqual(view.primaryTableParties.map((entry) => entry.id), [
    "isamaa", "reform", "sde", "ekre", "eesti200",
  ]);
  assert.deepEqual(view.minorTableParties.map((entry) => entry.id), ["small"]);
  assert.equal(view.thresholdWaste, 9);
});

test("removes coalition selections that no longer have projected seats", () => {
  const view = buildRatingsViewModel([
    party("isamaa", 30),
    party("reform", 20),
    party("sde", 15),
    party("ekre", 12),
  ], projection, new Set());

  assert.deepEqual(
    [...validCoalitionSelection(new Set(["reform", "departed"]), view.projectedParties)],
    ["reform"],
  );
});
