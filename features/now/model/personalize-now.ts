import type { WatchEntry } from "../../watchlist/model/watchlist.ts";
import type { NowCard } from "../../../lib/now-types.ts";

function signed(value: number | null): string {
  if (value === null) return "võrdlus puudub";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} pp`;
}

export function personalizedRatingsCards(cards: readonly NowCard[], watches: readonly WatchEntry[]): NowCard[] {
  const source = cards.find((card) => card.area === "ratings" && card.partyMetrics && card.seatCounts);
  if (!source?.partyMetrics || !source.seatCounts) return [];
  const personalized: NowCard[] = [];
  for (const watch of watches) {
    if (watch.kind === "party-rating") {
      const metric = source.partyMetrics[watch.targetId];
      if (!metric || source.entityIds.includes(watch.targetId)) continue;
      personalized.push({
        ...source,
        id: `watched:${watch.id}:${source.id}`,
        revisionId: `${source.revisionId}:${watch.targetId}:${metric.support}`,
        priority: source.priority + 1,
        headline: `${metric.name}: ${metric.support.toFixed(1)}%`,
        detail: `Muutus eelmise avaldatud 4 nädala koondiga ${signed(metric.change)}.`,
        entityIds: [watch.targetId],
        watchTarget: null,
        seatCounts: undefined,
        partyMetrics: undefined,
      });
    }
    if (watch.kind === "party-threshold") {
      const metric = source.partyMetrics[watch.targetId];
      if (!metric || metric.previousSupport === null) continue;
      const crossedUp = metric.previousSupport < 5 && metric.support >= 5;
      const crossedDown = metric.previousSupport >= 5 && metric.support < 5;
      if (!crossedUp && !crossedDown) continue;
      personalized.push({
        ...source,
        id: `watched:${watch.id}:${source.id}`,
        revisionId: `${source.revisionId}:${watch.targetId}:${metric.previousSupport}:${metric.support}`,
        priority: source.priority + 8,
        headline: `${metric.name} ${crossedUp ? "ületas" : "langes alla"} 5% künnise`,
        detail: `${metric.previousSupport.toFixed(1)}% → ${metric.support.toFixed(1)}%.`,
        entityIds: [watch.targetId],
        eventKind: "party-threshold",
        crossedThreshold: true,
        watchTarget: null,
        seatCounts: undefined,
        partyMetrics: undefined,
      });
    }
    if (watch.kind === "coalition-majority" && watch.partyIds) {
      const seats = watch.partyIds.reduce((total, id) => total + (source.seatCounts?.[id] ?? 0), 0);
      const previousSeats = source.previousSeatCounts
        ? watch.partyIds.reduce((total, id) => total + (source.previousSeatCounts?.[id] ?? 0), 0)
        : null;
      const missing = watch.partyIds.filter((id) => !(id in source.seatCounts!));
      personalized.push({
        ...source,
        id: `watched:${watch.id}:${source.id}`,
        revisionId: `${source.revisionId}:${watch.partyIds.join("+")}:${seats}`,
        priority: source.priority + 5,
        headline: watch.label,
        detail: `${seats}/101 kohta · ${seats >= 51 ? `enamus +${seats - 51}` : `enamusest puudu ${51 - seats}`}${missing.length ? ` · ${missing.length} erakonda jäi alla künnise` : ""}.`,
        entityIds: watch.partyIds,
        eventKind: "coalition-majority",
        hasMajority: seats >= 51,
        majorityChanged: previousSeats !== null && (previousSeats >= 51) !== (seats >= 51),
        watchTarget: null,
        seatCounts: undefined,
        previousSeatCounts: undefined,
        partyMetrics: undefined,
      });
    }
  }
  return personalized;
}

const euro = new Intl.NumberFormat("et-EE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function personalizedFinanceCards(cards: readonly NowCard[], watches: readonly WatchEntry[]): NowCard[] {
  const source = cards.find((card) => card.area === "political-finance" && card.financePartyMetrics);
  if (!source) return [];
  const personalized: NowCard[] = [];
  for (const watch of watches) {
    if (watch.kind === "political-finance-party") {
      const metric = source.financePartyMetrics?.[watch.targetId];
      if (!metric || source.entityIds.includes(watch.targetId)) continue;
      personalized.push({
        ...source,
        id: `watched:${watch.id}:${source.id}`,
        revisionId: `${metric.revisionId}:${watch.targetId}`,
        headline: `${metric.name}: ${metric.donations === null ? "annetuste koond puudub" : `${euro.format(metric.donations)} annetusi`}`,
        detail: `Tulud ${metric.income === null ? "—" : euro.format(metric.income)} · kulud ${metric.expenses === null ? "—" : euro.format(metric.expenses)}. Deklareeritud andmed.`,
        sourceUrl: metric.sourceUrl,
        entityIds: [watch.targetId],
        watchTarget: null,
        financePartyMetrics: undefined,
        financeDonorMetrics: undefined,
      });
    }
    if (watch.kind === "political-finance-donor") {
      const metric = source.financeDonorMetrics?.[watch.targetId];
      if (!metric) continue;
      personalized.push({
        ...source,
        id: `watched:${watch.id}:${source.id}`,
        revisionId: metric.revisionId,
        headline: `${metric.name}: ${euro.format(metric.amount)}`,
        detail: `${metric.partyName} deklareeritud annetused valitud aruandeperioodil. Kirjeldav summa, mitte hinnang mõjule.`,
        entityIds: [watch.targetId, metric.partyId],
        watchTarget: null,
        financePartyMetrics: undefined,
        financeDonorMetrics: undefined,
      });
    }
  }
  return personalized;
}

const voteLabels: Record<string, string> = {
  "in-favor": "poolt", against: "vastu", neutral: "erapooletu",
  "did-not-vote": "ei hääletanud", absent: "puudus", unknown: "teadmata valik",
};

function personalizedRiigikoguCards(cards: readonly NowCard[], watches: readonly WatchEntry[]): NowCard[] {
  const source = cards.find((card) => card.area === "riigikogu" && card.riigikoguMemberMetrics);
  if (!source) return [];
  const personalized: NowCard[] = [];
  for (const watch of watches) {
    if (watch.kind === "riigikogu-member") {
      const metric = source.riigikoguMemberMetrics?.[watch.targetId];
      if (!metric) continue;
      personalized.push({
        ...source, id: `watched:${watch.id}:${source.id}`,
        revisionId: `${source.revisionId}:${watch.targetId}:${metric.choice}`,
        headline: `${metric.name}: ${voteLabels[metric.choice] ?? metric.choice}`,
        detail: `${source.headline}${metric.factionName ? ` · ${metric.factionName}` : ""}.`,
        entityIds: [watch.targetId, ...(metric.factionId ? [metric.factionId] : [])], watchTarget: null,
        riigikoguMemberMetrics: undefined, riigikoguFactionMetrics: undefined,
      });
    }
    if (watch.kind === "riigikogu-faction") {
      const metric = source.riigikoguFactionMetrics?.[watch.targetId];
      if (!metric) continue;
      personalized.push({
        ...source, id: `watched:${watch.id}:${source.id}`,
        revisionId: `${source.revisionId}:${watch.targetId}:${metric.inFavor}:${metric.against}:${metric.neutral}:${metric.absent}:${metric.didNotVote}`,
        headline: metric.name,
        detail: `${source.headline} · poolt ${metric.inFavor}, vastu ${metric.against}, erapooletuid ${metric.neutral}, ei hääletanud ${metric.didNotVote}, puudus ${metric.absent}.`,
        entityIds: [watch.targetId], watchTarget: null,
        riigikoguMemberMetrics: undefined, riigikoguFactionMetrics: undefined,
      });
    }
  }
  return personalized;
}

export function personalizedNowCards(cards: readonly NowCard[], watches: readonly WatchEntry[]): NowCard[] {
  return [
    ...personalizedRatingsCards(cards, watches),
    ...personalizedRiigikoguCards(cards, watches),
    ...personalizedFinanceCards(cards, watches),
  ];
}
