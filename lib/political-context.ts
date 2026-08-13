export type GovernmentContext = {
  effectiveFrom: string;
  effectiveTo: string | null;
  partyIds: readonly string[];
  sourceUrl: string;
};

export const CURRENT_GOVERNMENT: GovernmentContext = Object.freeze({
  effectiveFrom: "2025-03-24",
  effectiveTo: null,
  partyIds: Object.freeze(["reform", "eesti200"]),
  sourceUrl: "https://valitsus.ee/en/coalition-agreement-between-estonian-reform-party-and-eesti-200",
});

export function isCurrentGovernmentParty(partyId: string): boolean {
  return CURRENT_GOVERNMENT.partyIds.includes(partyId);
}
