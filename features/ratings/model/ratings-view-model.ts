import { projectRiigikoguSeats, type SeatProjectionResult } from "../../../lib/seat-projection.ts";
import type { RatingsParty } from "../../../lib/ratings-types.ts";

const EXCLUDED_FROM_PROJECTION_KINDS = new Set(["independent", "other"]);

export type ProjectionParty = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  seats: number;
  support: number;
  change: number | null;
  previousSupport: number | null;
};

export type RatingsViewModel = {
  projectedParties: ProjectionParty[];
  hemicycleParties: ProjectionParty[];
  chamberParties: ProjectionParty[];
  selectedCoalitionSeats: number;
  selectedCoalitionCount: number;
  primaryTableParties: RatingsParty[];
  minorTableParties: RatingsParty[];
  thresholdWaste: number;
};

export function calculateRatingsProjection(parties: readonly RatingsParty[]): SeatProjectionResult | null {
  const electionParties = parties
    .filter((party): party is RatingsParty & { supportPct: number } =>
      party.supportPct !== null && !EXCLUDED_FROM_PROJECTION_KINDS.has(party.kind))
    .map((party) => ({ id: party.id, name: party.name, support: party.supportPct }));

  try {
    return projectRiigikoguSeats(electionParties);
  } catch {
    return null;
  }
}

export function buildRatingsViewModel(
  parties: readonly RatingsParty[],
  projection: SeatProjectionResult,
  selectedCoalitionIds: ReadonlySet<string>,
): RatingsViewModel {
  const pollById = new Map(parties.map((party) => [party.id, party]));
  const projectedParties = projection.projection.map((party) => {
    const pollParty = pollById.get(party.id);
    return {
      id: party.id,
      name: party.name,
      shortName: pollParty?.shortName ?? party.name,
      color: pollParty?.color ?? "#64748B",
      seats: party.seats,
      support: party.support,
      change: pollParty?.changePctPoints ?? null,
      previousSupport: pollParty?.previousSupportPct ?? null,
    };
  });
  const hemicycleParties = [...projectedParties].sort((left, right) =>
    right.seats - left.seats
    || right.support - left.support
    || left.name.localeCompare(right.name, "et"));
  const selected = projectedParties.filter((party) => selectedCoalitionIds.has(party.id));
  const chamberParties = selectedCoalitionIds.size === 0
    ? hemicycleParties
    : [
      ...hemicycleParties.filter((party) => selectedCoalitionIds.has(party.id)),
      ...hemicycleParties.filter((party) => !selectedCoalitionIds.has(party.id)),
    ];
  const tableParties = parties.filter((party) => party.kind === "party" && party.supportPct !== null);

  return {
    projectedParties,
    hemicycleParties,
    chamberParties,
    selectedCoalitionSeats: selected.reduce((total, party) => total + party.seats, 0),
    selectedCoalitionCount: selected.length,
    primaryTableParties: tableParties.filter((party) => (party.supportPct ?? 0) >= 5),
    minorTableParties: tableParties.filter((party) => (party.supportPct ?? 0) < 5),
    thresholdWaste: parties
      .filter((party) => party.kind !== "independent" && party.supportPct !== null && party.supportPct < 5)
      .reduce((total, party) => total + (party.supportPct ?? 0), 0),
  };
}

export function validCoalitionSelection(
  selectedCoalitionIds: ReadonlySet<string>,
  projectedParties: readonly ProjectionParty[],
): Set<string> {
  const projectedIds = new Set(projectedParties.map((party) => party.id));
  return new Set([...selectedCoalitionIds].filter((id) => projectedIds.has(id)));
}
