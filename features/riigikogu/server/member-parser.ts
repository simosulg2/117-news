import { resolvePartyAlias, validatePartyAliases } from "../../../lib/party-registry.ts";
import type { RiigikoguFactionSummary } from "@/lib/riigikogu-types";
import { array, cleanTitle, dateOnly, record, uuid } from "./riigikogu-parser.ts";

const FACTION_PARTY_ALIASES = {
  "Eesti Reformierakonna fraktsioon": "reform",
  "Eesti 200 fraktsioon": "eesti200",
  "Sotsiaaldemokraatliku Erakonna fraktsioon": "sde",
  "Isamaa fraktsioon": "isamaa",
  "Eesti Keskerakonna fraktsioon": "kesk",
  "Eesti Konservatiivse Rahvaerakonna fraktsioon": "ekre",
} as const;

validatePartyAliases(FACTION_PARTY_ALIASES);

export function parseCurrentFactions(value: unknown, membershipNumber: number): RiigikoguFactionSummary[] {
  const counts = new Map<string, RiigikoguFactionSummary>();
  for (const memberValue of array(value)) {
    const member = record(memberValue, "member");
    if (member.active !== true) continue;
    const faction = array(member.factions).map((entry) => record(entry, "member faction"))
      .find((entry) => {
        const membership = entry.membership ? record(entry.membership, "faction membership") : null;
        return membership?.membershipNumber === membershipNumber
          && dateOnly(membership.startDate) !== null
          && membership.endDate == null;
      });
    if (!faction) continue;
    const id = uuid(faction.uuid, "faction UUID");
    const name = cleanTitle(faction.name, "faction name");
    const previous = counts.get(id);
    counts.set(id, {
      id,
      name,
      partyId: resolvePartyAlias(name, FACTION_PARTY_ALIASES)?.id ?? null,
      memberCount: (previous?.memberCount ?? 0) + 1,
    });
  }
  return [...counts.values()].sort((left, right) => right.memberCount - left.memberCount || left.name.localeCompare(right.name, "et"));
}
