import assert from "node:assert/strict";
import test from "node:test";

import { parseRiigikoguAgenda } from "../features/riigikogu/server/agenda-parser.ts";
import { parseBillList } from "../features/riigikogu/server/bill-parser.ts";
import { parseCurrentFactions } from "../features/riigikogu/server/member-parser.ts";
import { parseVoteDetail } from "../features/riigikogu/server/vote-detail-parser.ts";

const IDs = {
  sitting: "06b6cd87-64be-4b2f-b7c9-1522ed71cad7",
  item: "9c25fafd-91a9-4bc0-97f9-7561758512a4",
  draft: "df97ebe8-0562-451b-a2b8-2b9d36bfcd7c",
  vote: "2baf03ae-c9b9-4647-b9f2-87f54e56ddb0",
  member1: "6b45cfb5-8a17-481c-b674-80fc00c6cf5d",
  member2: "7655e8d3-b658-49f0-8e09-f6cbc4a2c714",
  member3: "90074aa2-4938-41a9-8275-3a6efa1cee31",
  member4: "f6353ede-a0a5-4918-ab8b-790a1957c5cd",
  faction1: "8772fd6f-3197-6a53-2ffc-8c4d63407d1e",
  faction2: "d188e268-5d01-7e93-0c22-3ae7f0c1e851",
};

test("parses a populated agenda and converts Tallinn local time to UTC", () => {
  const agenda = parseRiigikoguAgenda({
    weekStartDate: "2026-06-15", weekEndDate: "2026-06-21", title: "XV nädal",
    sittings: [{
      uuid: IDs.sitting, title: "Täiskogu istung", sittingDateTime: "2026-06-15T15:00:00",
      agendaItems: [{
        uuid: IDs.item, title: "  Liiklusseaduse   eelnõu ", order: 1,
        type: { code: "EELNOU", value: "Eelnõu" }, stage: "TEINE_LUGEMINE",
        decision: { code: "SAATA_III", value: "Teine lugemine lõpetatud" },
        relatedDraft: { uuid: IDs.draft, title: "Liiklusseadus", mark: 835 },
      }],
    }],
  });
  assert.equal(agenda.sittings[0].startsAt, "2026-06-15T12:00:00.000Z");
  assert.equal(agenda.sittings[0].items[0].title, "Liiklusseaduse eelnõu");
  assert.equal(agenda.sittings[0].items[0].draft?.mark, 835);
});

test("accepts an empty official parliamentary week as useful data", () => {
  const agenda = parseRiigikoguAgenda({ weekStartDate: "2026-08-10", weekEndDate: "2026-08-16", sittings: [] });
  assert.deepEqual(agenda.sittings, []);
  assert.equal(agenda.title, null);
});

test("keeps absent and did-not-vote states distinct and reconciles official totals", () => {
  const decisions = ["POOLT", "VASTU", "EI_HAALETANUD", "PUUDUB"];
  const labels = ["poolt", "vastu", "ei hääletanud", "puudub"];
  const memberIds = [IDs.member1, IDs.member2, IDs.member3, IDs.member4];
  const detail = parseVoteDetail({
    uuid: IDs.vote, votingNumber: 104262, type: { code: "AVALIK", value: "Avalik" },
    description: "Lõpphääletus", startDateTime: "2026-06-18T12:07:29.373",
    present: 3, absent: 1, inFavor: 1, against: 1, neutral: 0, abstained: 2,
    voters: memberIds.map((uuid, index) => ({
      uuid, fullName: `Liige ${index + 1}`,
      faction: { uuid: index < 3 ? IDs.faction1 : IDs.faction2, name: index < 3 ? "Reform" : "SDE" },
      decision: { code: decisions[index], value: labels[index] },
    })),
  }, "2026-08-13T10:00:00.000Z");
  assert.deepEqual(detail.voters.map((voter) => voter.choice), ["in-favor", "against", "did-not-vote", "absent"]);
  assert.equal(detail.reconciles, true);
  assert.equal(detail.factions[0].plurality, null, "one in-favor and one against is a tie");
});

test("preserves unknown vote choices instead of silently recoding them", () => {
  const detail = parseVoteDetail({
    uuid: IDs.vote, votingNumber: 1, type: { value: "Avalik" }, description: "Test",
    startDateTime: "2026-01-15T10:00:00", present: 1, absent: 0,
    inFavor: 0, against: 0, neutral: 0, abstained: 1,
    voters: [{ uuid: IDs.member1, fullName: "Liige", decision: { code: "UUS_VALIK", value: "uus" } }],
  }, "2026-01-15T10:00:00Z");
  assert.equal(detail.voters[0].choice, "unknown");
  assert.equal(detail.voters[0].officialCode, "UUS_VALIK");
  assert.equal(detail.reconciles, false);
});

test("parses paginated active bills and tolerates missing optional fields", () => {
  const bills = parseBillList({ _embedded: { content: [{
    uuid: IDs.draft, title: "Ravikindlustuse seaduse muutmise seadus", mark: 983,
    draftTypeCode: "SE", activeDraftStage: "MENETLUSSE_VOETUD",
    activeDraftStatus: "MENETLUSSE_VOETUD", activeDraftStatusDate: "2026-06-19",
    initiated: "2026-06-18", leadingCommittee: null,
  }] }, page: { number: 0, totalPages: 26 } });
  assert.equal(bills.length, 1);
  assert.equal(bills[0].leadingCommittee, null);
  assert.equal(bills[0].statusDate, "2026-06-19");
});

test("current faction counts use open XV membership intervals, not historical membership", () => {
  const factions = parseCurrentFactions([{ active: true, factions: [
    { uuid: IDs.faction2, name: "Sotsiaaldemokraatliku Erakonna fraktsioon", membership: { membershipNumber: 15, startDate: "2023-04-10", endDate: "2024-01-01" } },
    { uuid: IDs.faction1, name: "Eesti Reformierakonna fraktsioon", membership: { membershipNumber: 15, startDate: "2024-01-01", endDate: null } },
  ] }]);
  assert.deepEqual(factions.map(({ partyId, memberCount }) => ({ partyId, memberCount })), [{ partyId: "reform", memberCount: 1 }]);
});
