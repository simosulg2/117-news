import assert from "node:assert/strict";
import test from "node:test";

import {
  PARTY_IDENTITIES,
  partyIdentity,
  resolvePartyAlias,
  validatePartyAliases,
} from "../lib/party-registry.ts";

test("canonical party IDs are unique and resolve to one presentation", () => {
  assert.equal(new Set(PARTY_IDENTITIES.map((party) => party.id)).size, PARTY_IDENTITIES.length);
  assert.equal(partyIdentity("reform")?.shortName, "Reform");
  assert.equal(partyIdentity("unknown"), null);
});

test("source adapters can map current and historical labels to one identity", () => {
  const aliases = {
    "Eesti Reformierakond": "reform",
    "Reformierakond": "reform",
  };
  validatePartyAliases(aliases);
  assert.equal(resolvePartyAlias("Reformierakond", aliases)?.id, "reform");
});

test("alias validation rejects collisions and unknown canonical IDs", () => {
  assert.throws(() => validatePartyAliases({ Isamaa: "isamaa", " isamaa ": "isamaa" }), /Duplicate/);
  assert.throws(() => validatePartyAliases({ Tulevik: "not-registered" }), /Unknown/);
});
