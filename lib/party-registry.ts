export type PartyIdentity = {
  id: string;
  name: string;
  shortName: string;
  color: string;
};

const identities = [
  { id: "reform", name: "Eesti Reformierakond", shortName: "Reform", color: "#F2D321" },
  { id: "eesti200", name: "Eesti 200", shortName: "Eesti 200", color: "#00AEEF" },
  { id: "sde", name: "Sotsiaaldemokraatlik Erakond", shortName: "SDE", color: "#E30613" },
  { id: "isamaa", name: "Isamaa", shortName: "Isamaa", color: "#009FE3" },
  { id: "kesk", name: "Eesti Keskerakond", shortName: "Keskerakond", color: "#008A4B" },
  { id: "ekre", name: "Eesti Konservatiivne Rahvaerakond", shortName: "EKRE", color: "#1D4E89" },
  { id: "parempoolsed", name: "Erakond Parempoolsed", shortName: "Parempoolsed", color: "#7C3AED" },
  { id: "rohelised", name: "Erakond Eestimaa Rohelised", shortName: "Rohelised", color: "#52A447" },
  { id: "erk", name: "Eesti Rahvuslased ja Konservatiivid", shortName: "ERK", color: "#1E3A5F" },
  { id: "koos", name: "Erakond KOOS", shortName: "KOOS", color: "#7F1D1D" },
  { id: "aru-pahe", name: "Vabaerakond Aru Pähe", shortName: "Aru Pähe", color: "#57534E" },
  { id: "vasakpartei", name: "Eestimaa Ühendatud Vasakpartei", shortName: "Vasakpartei", color: "#B91C1C" },
  { id: "vabaduspartei-pollumeeste-kogu", name: "Eesti Vabaduspartei – Põllumeeste Kogu", shortName: "EVP-PK", color: "#64748B" },
  { id: "elurikkus", name: "Elurikkuse Erakond", shortName: "Elurikkus", color: "#65A30D" },
  { id: "vabaerakond", name: "Eesti Vabaerakond", shortName: "Vabaerakond", color: "#475569" },
  { id: "iseseisvuspartei", name: "Eesti Iseseisvuspartei", shortName: "EIP", color: "#334155" },
  { id: "rahvusliberaalid-vabaerakond", name: "Eesti Rahvusliberaalid – Vabaerakond", shortName: "ERL-Vabaerakond", color: "#52525B" },
] as const satisfies readonly PartyIdentity[];

function buildRegistry(entries: readonly PartyIdentity[]): ReadonlyMap<string, PartyIdentity> {
  const registry = new Map<string, PartyIdentity>();
  for (const entry of entries) {
    if (!entry.id || registry.has(entry.id)) {
      throw new Error(`Duplicate or empty canonical party ID: ${entry.id}`);
    }
    registry.set(entry.id, Object.freeze({ ...entry }));
  }
  return registry;
}

const registry = buildRegistry(identities);

export const PARTY_IDENTITIES: readonly PartyIdentity[] = Object.freeze(
  identities.map((identity) => registry.get(identity.id)!),
);

export function partyIdentity(id: string): PartyIdentity | null {
  return registry.get(id) ?? null;
}

export function resolvePartyAlias(
  sourceLabel: string,
  aliases: Readonly<Record<string, string>>,
): PartyIdentity | null {
  const id = aliases[sourceLabel];
  return id ? partyIdentity(id) : null;
}

export function validatePartyAliases(aliases: Readonly<Record<string, string>>): void {
  const normalizedLabels = new Set<string>();
  for (const [label, id] of Object.entries(aliases)) {
    const normalized = label.trim().toLocaleLowerCase("et-EE");
    if (!normalized || normalizedLabels.has(normalized)) {
      throw new Error(`Duplicate or empty party source alias: ${label}`);
    }
    if (!partyIdentity(id)) throw new Error(`Unknown canonical party ID: ${id}`);
    normalizedLabels.add(normalized);
  }
}
