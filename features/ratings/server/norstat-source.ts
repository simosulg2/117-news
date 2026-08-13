import {
  partyIdentity,
  resolvePartyAlias,
  validatePartyAliases,
} from "../../../lib/party-registry.ts";
import type { RatingsPartyKind, RatingsSource } from "../../../lib/ratings-types.ts";

export const NORSTAT_RATINGS_DATA_URL =
  "https://kiir.kusitlus.com/_datasets_public/rk-ratings/ratings-compact.json";

export const NORSTAT_RATINGS_SOURCE: RatingsSource = {
  id: "norstat-yui",
  label: "Ühiskonnauuringute Instituut / Norstat",
  pollster: "Norstat Eesti AS",
  commissioner: "MTÜ Ühiskonnauuringute Instituut",
  dataUrl: NORSTAT_RATINGS_DATA_URL,
  documentationUrl: "https://rk.kusitlus.com/andmed",
  methodologyUrl: "https://reitingud.ee/",
  publisherUrl: "https://reitingud.ee/uudised/",
  license: null,
  schemaVersion: 3,
};

export type PartyPresentation = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  kind?: RatingsPartyKind;
};

const NORSTAT_PARTY_ALIASES: Readonly<Record<string, string>> = {
  "Sotsiaaldemokraatlik Erakond": "sde",
  "Eesti Reformierakond": "reform",
  "Erakond Eestimaa Rohelised": "rohelised",
  "Eesti Vabaduspartei - Põllumeeste kogu": "vabaduspartei-pollumeeste-kogu",
  "Eestimaa Ühendatud Vasakpartei": "vasakpartei",
  "Eesti Konservatiivne Rahvaerakond": "ekre",
  "Eesti Keskerakond": "kesk",
  Isamaa: "isamaa",
  "Elurikkuse erakond": "elurikkus",
  "Eesti 200": "eesti200",
  "Eesti Vabaerakond": "vabaerakond",
  "Eesti Iseseisvuspartei": "iseseisvuspartei",
  "Erakond Parempoolsed": "parempoolsed",
  "Eesti Rahvuslased ja Konservatiivid (ERK)": "erk",
  "Erakond KOOS": "koos",
  "Vabaerakond Aru Pähe": "aru-pahe",
  "Eesti Rahvusliberaalid - Vabaerakond": "rahvusliberaalid-vabaerakond",
};

validatePartyAliases(NORSTAT_PARTY_ALIASES);

const SPECIAL_PRESENTATION: Readonly<Record<string, PartyPresentation>> = {
  "Muu erakond": {
    id: "other",
    name: "Muu erakond",
    shortName: "Muu",
    color: "#64748B",
    kind: "other",
  },
  "Üksikkandidaadi poolt": {
    id: "independent",
    name: "Üksikkandidaat",
    shortName: "Üksikkandidaat",
    color: "#78716C",
    kind: "independent",
  },
  "Mihhail Stalnuhhin": {
    id: "mihhail-stalnuhhin",
    name: "Mihhail Stalnuhhin",
    shortName: "Stalnuhhin",
    color: "#78716C",
    kind: "independent",
  },
};

const FALLBACK_PARTY_COLOR = "#64748B";

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("et-EE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function partyPresentation(sourceName: string, sourceIndex: number): PartyPresentation {
  const special = SPECIAL_PRESENTATION[sourceName];
  if (special) return special;
  const known = resolvePartyAlias(sourceName, NORSTAT_PARTY_ALIASES);
  if (known) return known;
  const sourceSlug = slug(sourceName) || `party-${sourceIndex}`;
  return {
    id: `source-${sourceSlug}`,
    name: sourceName,
    shortName: sourceName,
    color: FALLBACK_PARTY_COLOR,
  };
}

// Keep this explicit check close to the adapter so registry drift fails at startup.
for (const id of Object.values(NORSTAT_PARTY_ALIASES)) {
  if (!partyIdentity(id)) throw new Error(`Norstat party alias points to unknown ID: ${id}`);
}
