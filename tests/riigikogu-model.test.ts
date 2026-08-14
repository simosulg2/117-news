import assert from "node:assert/strict";
import test from "node:test";
import { buildFactionMatrix, factionPlurality } from "../features/riigikogu/model/faction-matrix.ts";
import { selectAgendaSittings } from "../features/riigikogu/model/agenda-selection.ts";
import { riigikoguMembershipLabel } from "../features/riigikogu/model/membership-label.ts";
import type { RiigikoguAgenda, RiigikoguSitting, RiigikoguVoter } from "../lib/riigikogu-types.ts";

function voter(name: string, choice: RiigikoguVoter["choice"]): RiigikoguVoter {
  return { memberId: name, fullName: name, factionId: "faction", factionName: "Fraktsioon", choice, officialCode: choice, officialLabel: choice };
}

test("derives descriptive deviations only from a unique cast-vote plurality", () => {
  const matrix = buildFactionMatrix([voter("A", "in-favor"), voter("B", "in-favor"), voter("C", "against"), voter("D", "absent")]);
  assert.equal(matrix[0].plurality, "in-favor");
  assert.deepEqual(matrix[0].deviations, ["C"]);
});

test("ties and factions with no cast votes have no plurality", () => {
  assert.equal(factionPlurality({ "in-favor": 1, against: 1, neutral: 0, "did-not-vote": 0, absent: 0, unknown: 0 }), null);
  assert.equal(factionPlurality({ "in-favor": 0, against: 0, neutral: 0, "did-not-vote": 3, absent: 1, unknown: 0 }), null);
});

function sitting(id: string, startsAt: string): RiigikoguSitting {
  return { id, startsAt, title: id, items: [] };
}

function agenda(sittings: RiigikoguSitting[]): RiigikoguAgenda {
  return { weekStart: "2026-06-15", weekEnd: "2026-06-21", title: null, sittings };
}

test("today agenda uses the Europe/Tallinn calendar date", () => {
  const selection = selectAgendaSittings(
    agenda([sitting("Tallinn Tuesday", "2026-06-15T21:30:00.000Z")]),
    new Date("2026-06-15T22:00:00.000Z"),
  );
  assert.equal(selection.mode, "today");
  assert.deepEqual(selection.sittings.map((item) => item.id), ["Tallinn Tuesday"]);
});

test("agenda falls back only to every sitting on the next published Tallinn date", () => {
  const selection = selectAgendaSittings(agenda([
    sitting("past", "2026-06-15T07:00:00.000Z"),
    sitting("later next day", "2026-06-17T11:00:00.000Z"),
    sitting("first next day", "2026-06-17T06:00:00.000Z"),
    sitting("day after", "2026-06-18T07:00:00.000Z"),
  ]), new Date("2026-06-16T09:00:00.000Z"));
  assert.equal(selection.mode, "next");
  assert.deepEqual(selection.sittings.map((item) => item.id), ["first next day", "later next day"]);
});

test("agenda reports empty when the official window contains no current or future sitting", () => {
  const selection = selectAgendaSittings(
    agenda([sitting("past", "2026-06-15T07:00:00.000Z")]),
    new Date("2026-06-16T09:00:00.000Z"),
  );
  assert.deepEqual(selection, { mode: "empty", sittings: [] });
});

test("formats the current membership without a term-specific label", () => {
  assert.equal(riigikoguMembershipLabel(15), "XV Riigikogu");
  assert.equal(riigikoguMembershipLabel(16), "XVI Riigikogu");
  assert.equal(riigikoguMembershipLabel(null), "Riigikogu");
});
