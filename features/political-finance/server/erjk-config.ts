import { partyIdentity, resolvePartyAlias, validatePartyAliases } from "../../../lib/party-registry.ts";

export const ERJK_ORIGIN = "https://www.erjk.ee";
export const ERJK_API_ORIGIN = `${ERJK_ORIGIN}/et/api`;
export const ERJK_OPEN_DATA_URL = "https://www.erjk.ee/et/avaandmetest";
export const ERJK_API_DOCUMENTATION_URL = "https://www.erjk.ee/avaandmed/";
export const ERJK_REPORTS_URL =
  "https://www.erjk.ee/et/rahastamise-aruanded/erakondade-tulude-ja-laekumiste-aruanded";
export const ERJK_LICENCE_URL = "https://creativecommons.org/licenses/by-sa/3.0/";

const ERJK_PARTY_ALIASES: Readonly<Record<string, string>> = {
  "Eesti Iseseisvuspartei": "iseseisvuspartei",
  "Eesti Reformierakond": "reform",
  "Eesti Vabaduspartei - Põllumeeste Kogu": "vabaduspartei-pollumeeste-kogu",
  "Eesti Vabaerakond": "vabaerakond",
  "Eesti Vasakliit": "vasakpartei",
  "EKRE - Eesti Konservatiivne Rahvaerakond": "ekre",
  "Elurikkuse Erakond": "elurikkus",
  "Erakond Eesti 200": "eesti200",
  "Erakond Eestimaa Rohelised": "rohelised",
  "Erakond Parempoolsed": "parempoolsed",
  "Eesti Keskerakond": "kesk",
  "Eesti Rahvuslased ja Konservatiivid": "erk",
  "ISAMAA Erakond": "isamaa",
  "KOOS Erakond": "koos",
  "Sotsiaaldemokraatlik Erakond": "sde",
  "Vabaerakond Aru Pähe": "aru-pahe",
};

validatePartyAliases(ERJK_PARTY_ALIASES);

const ERJK_PARTY_IDS: Readonly<Record<string, string>> = {
  "162": "iseseisvuspartei", "158": "reform", "165": "vabaduspartei-pollumeeste-kogu",
  "577": "vabaerakond", "157": "vasakpartei", "164": "ekre", "804": "elurikkus",
  "803": "eesti200", "161": "rohelised", "6577": "parempoolsed", "163": "kesk",
  "8272": "erk", "159": "isamaa", "7421": "koos", "160": "sde", "4412": "aru-pahe",
};

export type ErjkPartyPresentation = {
  id: string;
  canonicalPartyId: string | null;
  name: string;
  shortName: string;
  color: string;
};

export function erjkPartyPresentation(sourcePartyId: string, sourceName: string): ErjkPartyPresentation {
  const idIdentity = partyIdentity(ERJK_PARTY_IDS[sourcePartyId] ?? "");
  const nameIdentity = resolvePartyAlias(sourceName, ERJK_PARTY_ALIASES);
  if (idIdentity && nameIdentity && idIdentity.id !== nameIdentity.id) {
    throw new Error("ERJK party ID and name resolve to different canonical parties");
  }
  const identity = idIdentity ?? nameIdentity;
  if (!identity) {
    return {
      id: `erjk-${sourcePartyId}`,
      canonicalPartyId: null,
      name: sourceName,
      shortName: sourceName,
      color: "#64748B",
    };
  }
  return {
    id: identity.id,
    canonicalPartyId: identity.id,
    name: identity.name,
    shortName: identity.shortName,
    color: identity.color,
  };
}

export function erjkSourcePartyId(canonicalPartyId: string): string | null {
  if (!partyIdentity(canonicalPartyId)) return null;
  const entry = Object.entries(ERJK_PARTY_ALIASES).find(([, id]) => id === canonicalPartyId);
  if (!entry) return null;
  return Object.entries(ERJK_PARTY_IDS).find(([, id]) => id === canonicalPartyId)?.[0] ?? null;
}

export function erjkSourcePartyName(canonicalPartyId: string): string | null {
  return Object.entries(ERJK_PARTY_ALIASES).find(([, id]) => id === canonicalPartyId)?.[0] ?? null;
}
