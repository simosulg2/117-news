import assert from "node:assert/strict";
import test from "node:test";

import { buildNowCards } from "../features/now/model/build-now.ts";
import { emptyNowSeenState, isNowCardNew, markNowCardsSeen, parseNowSeenState } from "../features/now/model/seen-state.ts";
import { personalizedNowCards, personalizedRatingsCards } from "../features/now/model/personalize-now.ts";
import { addWatch, emptyWatchlist } from "../features/watchlist/model/watchlist.ts";
import type { NewsResponse } from "../lib/types.ts";
import type { NowCard } from "../lib/now-types.ts";
import type { RatingsResponse } from "../lib/ratings-types.ts";
import type { WeatherWarningsResponse } from "../lib/weather-warning-types.ts";

const news: NewsResponse = {
  updatedAt: "2026-08-13T10:00:00Z",
  sources: { loaded: 1, total: 1, failed: [], failures: [] },
  items: [
    { id: "newer", title: "Newer", link: "https://news.example/newer", summary: "", publishedAt: "2026-08-13T10:00:00Z", category: "Eesti", source: "ERR", related: [] },
    { id: "developing", title: "Developing", link: "https://news.example/developing", summary: "", publishedAt: "2026-08-13T09:00:00Z", category: "Eesti", source: "ERR", related: [
      { id: "related", title: "Related", link: "https://news.example/related", summary: "", publishedAt: "2026-08-13T09:30:00Z", category: "Eesti", source: "Postimees" },
    ] },
  ],
};

test("overview ranks developing coverage deterministically", () => {
  const cards = buildNowCards({ news });
  assert.equal(cards[0].id, "news:developing");
  assert.match(cards[0].detail, /2 seotud/);
});

function ratings(previous: Array<number | null>, changes: Array<number | null>): RatingsResponse {
  const ids = ["reform", "eesti200", "isamaa"];
  return {
    poll: {
      source: {
        id: "norstat-yui", label: "Ühiskonnauuringute Instituut / Norstat", pollster: "Norstat Eesti AS",
        commissioner: "MTÜ Ühiskonnauuringute Instituut", dataUrl: "https://example.com/data",
        documentationUrl: "https://example.com/docs", methodologyUrl: "https://example.com/method",
        publisherUrl: "https://example.com/publisher", license: null, schemaVersion: 3,
      },
      wave: { id: "wave-1", kind: "rolling-four-week", startDate: "2026-07-01", endDate: "2026-07-28" },
      previousWave: null, sample: { total: 4000, voters: null, effectiveTotal: 2600, effectiveVoters: null },
      withoutPartyPreferencePct: 35, basis: "party-preference respondents", population: "Estonian citizens aged 18+",
      parties: ids.map((id, index) => ({
        id, name: id, shortName: id, sourceName: id, color: "#000", kind: "party",
        supportPct: [30, 8, 25][index], previousSupportPct: previous[index], changePctPoints: changes[index],
      })),
    },
    fetchedAt: "2026-08-01T08:00:00Z", sourceUpdatedAt: "2026-08-01T07:30:00Z",
  };
}

test("ratings overview does not invent movement or a previous coalition projection", () => {
  const noComparison = buildNowCards({ ratings: ratings([null, null, null], [null, null, null]) })[0];
  assert.match(noComparison.detail, /võrreldavat muutust pole/);
  assert.doesNotMatch(noComparison.headline, /0\.0 pp/);
  assert.equal(noComparison.happenedAt, "2026-08-01T07:30:00Z");
  assert.equal(noComparison.previousSeatCounts, undefined);
  const mixed = buildNowCards({ ratings: ratings([29, null, 24], [1, null, 1]) })[0];
  assert.equal(mixed.previousSeatCounts, undefined);
});

test("overview shows an ungraded nationwide warning even without weather observations", () => {
  const warnings: WeatherWarningsResponse = {
    area: "Võru maakond",
    warnings: [{
      id: "weather-warning:national", revisionId: "revision-1", area: "Eesti", level: null,
      phenomenon: "Üleriigiline hoiatus", description: "Kogu Eestis kehtib oluline ilmateade.",
      validFrom: null, validTo: null,
    }],
    fetchedAt: "2026-08-13T10:00:00Z", sourceUpdatedAt: null,
    source: {
      name: "Keskkonnaagentuur / Ilmateenistus",
      url: "https://ilmateenistus.ee/ilma_andmed/xml/hoiatus.php",
      documentationUrl: "https://keskkonnaportaal.ee/et/avaandmed/ilmaprognoosid",
      license: "CC BY 4.0",
    },
  };
  const [warningCard] = buildNowCards({ warnings });
  assert.equal(warningCard.eventKind, "weather-warning");
  assert.equal(warningCard.headline, "Üleriigiline hoiatus");
  assert.doesNotMatch(warningCard.headline, /Tase/);
  assert.match(warningCard.detail, /Vaatlus pole saadaval/);
});

test("overview prefers active warnings, labels upcoming warnings, and omits expired ones", () => {
  const warningBase: WeatherWarningsResponse = {
    area: "Võru maakond", fetchedAt: "2026-08-13T10:00:00Z", sourceUpdatedAt: null,
    warnings: [],
    source: {
      name: "Keskkonnaagentuur / Ilmateenistus", url: "https://example.com/warnings",
      documentationUrl: "https://example.com/docs", license: "CC BY 4.0",
    },
  };
  const expired = {
    id: "expired", revisionId: "1", area: "Võru linn", level: 3 as const,
    phenomenon: "Aegunud", description: "Aegunud hoiatus.", validFrom: "2026-08-13T08:00:00Z", validTo: "2026-08-13T09:00:00Z",
  };
  const active = {
    id: "active", revisionId: "1", area: "Antsla vald", level: 1 as const,
    phenomenon: "Aktiivne", description: "Kehtiv hoiatus.", validFrom: "2026-08-13T09:00:00Z", validTo: "2026-08-13T11:00:00Z",
  };
  const upcoming = {
    id: "upcoming", revisionId: "1", area: "Rõuge vald", level: 3 as const,
    phenomenon: "Tulevane", description: "Tulevane hoiatus.", validFrom: "2026-08-13T12:00:00Z", validTo: "2026-08-13T14:00:00Z",
  };
  const nowMs = Date.parse("2026-08-13T10:00:00Z");
  const [activeCard] = buildNowCards({ warnings: { ...warningBase, warnings: [expired, upcoming, active] } }, nowMs);
  assert.equal(activeCard.id, "active");
  assert.match(activeCard.detail, /kehtib praegu/);
  assert.doesNotMatch(activeCard.headline, /Tulekul/);

  const [upcomingCard] = buildNowCards({ warnings: { ...warningBase, warnings: [expired, upcoming] } }, nowMs);
  assert.equal(upcomingCard.id, "upcoming");
  assert.match(upcomingCard.headline, /^Tulekul/);
  assert.match(upcomingCard.detail, /Tulevane ametlik hoiatus/);
  assert.deepEqual(buildNowCards({ warnings: { ...warningBase, warnings: [expired] } }, nowMs), []);
});

function card(overrides: Partial<NowCard> = {}): NowCard {
  return {
    id: "news:1", revisionId: "a", area: "news", priority: 1,
    happenedAt: "2026-08-13T10:00:00Z", headline: "Headline", detail: "Detail",
    targetUrl: "/", sourceUrl: "https://example.com", sourceLabel: "Source",
    entityIds: [], eventKind: "news", watchTarget: null, ...overrides,
  };
}

test("first visit is a quiet baseline and repeat visit remains quiet", () => {
  const first = emptyNowSeenState();
  assert.equal(isNowCardNew(first, card()), false);
  const seen = markNowCardsSeen(first, [card()]);
  assert.equal(isNowCardNew(seen, card()), false);
});

test("newer IDs and revised releases are new, older out-of-order cards are not", () => {
  const seen = markNowCardsSeen(emptyNowSeenState(), [card()]);
  assert.equal(isNowCardNew(seen, card({ id: "news:2", happenedAt: "2026-08-13T11:00:00Z" })), true);
  assert.equal(isNowCardNew(seen, card({ revisionId: "b" })), true);
  assert.equal(isNowCardNew(seen, card({ id: "news:old", happenedAt: "2026-08-12T11:00:00Z" })), false);
});

test("corrupted or unknown seen state is reset safely", () => {
  assert.deepEqual(parseNowSeenState("bad"), emptyNowSeenState());
  assert.deepEqual(parseNowSeenState('{"version":9}'), emptyNowSeenState());
});

test("saved coalitions and threshold crossings become personal rating cards", () => {
  const rating = card({
    id: "ratings:1", area: "ratings", eventKind: "party-rating", entityIds: ["isamaa"],
    seatCounts: { reform: 30, eesti200: 22, isamaa: 49 },
    previousSeatCounts: { reform: 29, eesti200: 20, isamaa: 52 },
    partyMetrics: {
      isamaa: { name: "Isamaa", support: 25, previousSupport: 24, change: 1 },
      eesti200: { name: "Eesti 200", support: 5.1, previousSupport: 4.9, change: 0.2 },
    },
  });
  let watches = addWatch(emptyWatchlist(), { kind: "coalition-majority", targetId: "reform+eesti200", label: "REF + E200", partyIds: ["reform", "eesti200"] });
  watches = addWatch(watches, { kind: "party-threshold", targetId: "eesti200", label: "Eesti 200 5%" });
  const personal = personalizedRatingsCards([rating], watches.entries);
  assert.equal(personal.length, 2);
  assert.match(personal.find((item) => item.eventKind === "coalition-majority")!.detail, /52\/101/);
  assert.equal(personal.find((item) => item.eventKind === "coalition-majority")!.majorityChanged, true);
  assert.match(personal.find((item) => item.eventKind === "party-threshold")!.headline, /ületas/);
});

test("member, faction, party, and donor watches produce focused personal cards", () => {
  const parliament = card({
    id: "riigikogu-vote:1", area: "riigikogu", eventKind: "riigikogu", entityIds: ["member-1", "faction-1"],
    headline: "Eelnõu hääletus",
    riigikoguMemberMetrics: { "member-1": { name: "Mari Maasikas", choice: "in-favor", factionId: "faction-1", factionName: "Näidisfraktsioon" } },
    riigikoguFactionMetrics: { "faction-1": { name: "Näidisfraktsioon", inFavor: 8, against: 2, neutral: 1, absent: 1, didNotVote: 0 } },
  });
  const finance = card({
    id: "political-finance:2026-Q2", area: "political-finance", eventKind: "political-finance", entityIds: ["isamaa"],
    financePartyMetrics: { reform: { name: "Reformierakond", income: 100, expenses: 80, donations: 20, revisionId: "party-rev", sourceUrl: "https://example.com/report" } },
    financeDonorMetrics: { "donor-1": { name: "Anu Näide", amount: 20, partyId: "reform", partyName: "Reformierakond", revisionId: "donor-rev" } },
  });
  let watches = addWatch(emptyWatchlist(), { kind: "riigikogu-member", targetId: "member-1", label: "Mari Maasikas" });
  watches = addWatch(watches, { kind: "riigikogu-faction", targetId: "faction-1", label: "Näidisfraktsioon" });
  watches = addWatch(watches, { kind: "political-finance-party", targetId: "reform", label: "Reformierakond" });
  watches = addWatch(watches, { kind: "political-finance-donor", targetId: "donor-1", label: "Anu Näide" });
  const personal = personalizedNowCards([parliament, finance], watches.entries);
  assert.equal(personal.length, 4);
  assert.match(personal.find((item) => item.entityIds.includes("member-1"))!.headline, /poolt/);
  assert.match(personal.find((item) => item.entityIds.includes("faction-1") && item.headline === "Näidisfraktsioon")!.detail, /poolt 8/);
  assert.equal(personal.find((item) => item.entityIds.includes("donor-1"))!.revisionId, "donor-rev");
});
