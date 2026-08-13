import { CURRENT_GOVERNMENT } from "../../../lib/political-context.ts";
import type { NowCard } from "../../../lib/now-types.ts";
import type { RatingsResponse } from "../../../lib/ratings-types.ts";
import type { RiigikoguOverviewResponse, RiigikoguVoteDetail } from "../../../lib/riigikogu-types.ts";
import { projectRiigikoguSeats } from "../../../lib/seat-projection.ts";
import { nowFingerprint, nowTimestamp } from "./now-card-utils.ts";

export function buildRatingsNowCard(data: RatingsResponse): NowCard | null {
  const parties = data.poll.parties.filter((party) => party.kind === "party" && party.supportPct !== null);
  const comparable = parties.filter((party) => party.changePctPoints !== null);
  const focus = [...(comparable.length > 0 ? comparable : parties)].sort((left, right) =>
    (comparable.length > 0 ? Math.abs(right.changePctPoints!) - Math.abs(left.changePctPoints!) : 0)
      || (right.supportPct ?? 0) - (left.supportPct ?? 0) || left.id.localeCompare(right.id))[0];
  if (!focus) return null;
  const projection = projectRiigikoguSeats(parties.map((party) => ({ id: party.id, name: party.name, support: party.supportPct! })));
  const hasCompletePreviousWave = parties.length > 0 && parties.every((party) => party.previousSupportPct !== null);
  const previousProjection = hasCompletePreviousWave
    ? projectRiigikoguSeats(parties.map((party) => ({ id: party.id, name: party.name, support: party.previousSupportPct! })))
    : null;
  const governmentSeats = projection.projection.filter((party) => CURRENT_GOVERNMENT.partyIds.includes(party.id))
    .reduce((total, party) => total + party.seats, 0);
  const previousGovernmentSeats = previousProjection?.projection.filter((party) => CURRENT_GOVERNMENT.partyIds.includes(party.id))
    .reduce((total, party) => total + party.seats, 0) ?? null;
  const movement = focus.changePctPoints;
  const headline = movement === null
    ? `${focus.shortName}: ${focus.supportPct?.toFixed(1)}%`
    : `${focus.shortName}: ${focus.supportPct?.toFixed(1)}% (${movement > 0 ? "+" : ""}${movement.toFixed(1)} pp)`;
  const comparison = movement === null
    ? "Eelmise koondiga võrreldavat muutust pole avaldatud."
    : "Suurim nädalane muutus 4 nädala koondis.";
  const majority = previousGovernmentSeats !== null && previousGovernmentSeats < 51 && governmentSeats >= 51
    ? "ja ületas enamuse piiri"
    : previousGovernmentSeats !== null && previousGovernmentSeats >= 51 && governmentSeats < 51
      ? "ja kaotas enamuse"
      : governmentSeats >= 51 ? "ning omaks enamust" : "ega omaks enamust";
  return {
    id: `ratings:${data.poll.wave.id}`,
    revisionId: nowFingerprint(`${data.poll.wave.id}|${parties.map((party) => `${party.id}:${party.supportPct}`).join("|")}`),
    area: "ratings", priority: governmentSeats >= 51 ? 60 : 55,
    happenedAt: data.sourceUpdatedAt ?? data.fetchedAt, headline,
    detail: `${comparison} Koond ${data.poll.wave.startDate}–${data.poll.wave.endDate}. Praegune valitsus saaks ${governmentSeats}/101 kohta ${majority}.`,
    targetUrl: "/reitingud", sourceUrl: data.poll.source.publisherUrl, sourceLabel: data.poll.source.label,
    entityIds: [focus.id], eventKind: "party-rating", hasMajority: governmentSeats >= 51,
    seatCounts: Object.fromEntries(projection.projection.map((party) => [party.id, party.seats])),
    previousSeatCounts: previousProjection ? Object.fromEntries(previousProjection.projection.map((party) => [party.id, party.seats])) : undefined,
    partyMetrics: Object.fromEntries(parties.map((party) => [party.id, {
      name: party.name, support: party.supportPct!, previousSupport: party.previousSupportPct, change: party.changePctPoints,
    }])),
    watchTarget: { kind: "party-rating", targetId: focus.id, label: focus.name },
  };
}

function latestVoteCard(data: RiigikoguOverviewResponse, detail?: RiigikoguVoteDetail): NowCard | null {
  const vote = [...data.votes].sort((left, right) => nowTimestamp(right.startedAt) - nowTimestamp(left.startedAt))[0];
  if (!vote) return null;
  const draftId = vote.draft?.id ?? "latest-votes";
  const exactDetail = detail?.id === vote.id ? detail : undefined;
  const memberMetrics = exactDetail ? Object.fromEntries(exactDetail.voters.map((voter) => [voter.memberId, {
    name: voter.fullName, choice: voter.choice, factionId: voter.factionId, factionName: voter.factionName,
  }])) : undefined;
  const factionMetrics = exactDetail ? Object.fromEntries(exactDetail.factions.map((faction) => [faction.factionId, {
    name: faction.factionName, inFavor: faction.totals["in-favor"], against: faction.totals.against,
    neutral: faction.totals.neutral, absent: faction.totals.absent, didNotVote: faction.totals["did-not-vote"],
  }])) : undefined;
  return {
    id: `riigikogu-vote:${vote.id}`, revisionId: nowFingerprint(`${vote.description}|${JSON.stringify(vote.totals)}`),
    area: "riigikogu", priority: 65, happenedAt: vote.startedAt, headline: vote.description,
    detail: `Poolt ${vote.totals.inFavor}, vastu ${vote.totals.against}, erapooletuid ${vote.totals.neutral}. ${vote.draft ? `Eelnõu ${vote.draft.mark ?? ""}.`.trim() : vote.type}`,
    targetUrl: "/riigikogu", sourceUrl: vote.sourceUrl, sourceLabel: data.attribution.name,
    entityIds: [vote.id, draftId, ...Object.keys(memberMetrics ?? {}), ...Object.keys(factionMetrics ?? {})], eventKind: "riigikogu",
    riigikoguMemberMetrics: memberMetrics, riigikoguFactionMetrics: factionMetrics,
    watchTarget: { kind: "riigikogu-bill", targetId: draftId, label: vote.draft?.title ?? "Riigikogu hääletused" },
  };
}

function nextAgendaCard(data: RiigikoguOverviewResponse, nowMs: number): NowCard | null {
  const sitting = data.agenda?.sittings.filter((item) => nowTimestamp(item.startsAt) >= nowMs)
    .sort((left, right) => nowTimestamp(left.startsAt) - nowTimestamp(right.startsAt))[0];
  const item = sitting?.items[0];
  if (!sitting || !item) return null;
  const targetId = item.draft?.id ?? item.id;
  return {
    id: `riigikogu-agenda:${item.id}`, revisionId: nowFingerprint(`${sitting.startsAt}|${item.title}|${item.stage ?? ""}`),
    area: "riigikogu", priority: 48, happenedAt: sitting.startsAt, headline: item.title,
    detail: `Järgmine kinnitatud päevakorrapunkt${item.stage ? ` · ${item.stage}` : ""}.`, targetUrl: "/riigikogu",
    sourceUrl: item.draft?.sourceUrl ?? data.attribution.sourceUrl, sourceLabel: data.attribution.name,
    entityIds: [item.id, targetId], eventKind: "riigikogu",
    watchTarget: { kind: "riigikogu-bill", targetId, label: item.title },
  };
}

export function buildRiigikoguNowCards(data: RiigikoguOverviewResponse, detail?: RiigikoguVoteDetail, nowMs = Date.now()): NowCard[] {
  return [latestVoteCard(data, detail), nextAgendaCard(data, nowMs)].filter((card): card is NowCard => card !== null);
}
