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

const PARTY_PRESENTATION: Readonly<Record<string, PartyPresentation>> = {
  "Sotsiaaldemokraatlik Erakond": {
    id: "sde",
    name: "Sotsiaaldemokraatlik Erakond",
    shortName: "SDE",
    color: "#E30613",
  },
  "Eesti Reformierakond": {
    id: "reform",
    name: "Eesti Reformierakond",
    shortName: "Reform",
    color: "#F2D321",
  },
  "Erakond Eestimaa Rohelised": {
    id: "rohelised",
    name: "Erakond Eestimaa Rohelised",
    shortName: "Rohelised",
    color: "#52A447",
  },
  "Eesti Vabaduspartei - Põllumeeste kogu": {
    id: "vabaduspartei-pollumeeste-kogu",
    name: "Eesti Vabaduspartei – Põllumeeste Kogu",
    shortName: "EVP-PK",
    color: "#64748B",
  },
  "Eestimaa Ühendatud Vasakpartei": {
    id: "vasakpartei",
    name: "Eestimaa Ühendatud Vasakpartei",
    shortName: "Vasakpartei",
    color: "#B91C1C",
  },
  "Eesti Konservatiivne Rahvaerakond": {
    id: "ekre",
    name: "Eesti Konservatiivne Rahvaerakond",
    shortName: "EKRE",
    color: "#1D4E89",
  },
  "Eesti Keskerakond": {
    id: "kesk",
    name: "Eesti Keskerakond",
    shortName: "Keskerakond",
    color: "#008A4B",
  },
  Isamaa: {
    id: "isamaa",
    name: "Isamaa",
    shortName: "Isamaa",
    color: "#009FE3",
  },
  "Muu erakond": {
    id: "other",
    name: "Muu erakond",
    shortName: "Muu",
    color: "#64748B",
    kind: "other",
  },
  "Elurikkuse erakond": {
    id: "elurikkus",
    name: "Elurikkuse Erakond",
    shortName: "Elurikkus",
    color: "#65A30D",
  },
  "Eesti 200": {
    id: "eesti200",
    name: "Eesti 200",
    shortName: "Eesti 200",
    color: "#00AEEF",
  },
  "Eesti Vabaerakond": {
    id: "vabaerakond",
    name: "Eesti Vabaerakond",
    shortName: "Vabaerakond",
    color: "#475569",
  },
  "Eesti Iseseisvuspartei": {
    id: "iseseisvuspartei",
    name: "Eesti Iseseisvuspartei",
    shortName: "EIP",
    color: "#334155",
  },
  "Erakond Parempoolsed": {
    id: "parempoolsed",
    name: "Erakond Parempoolsed",
    shortName: "Parempoolsed",
    color: "#7C3AED",
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
  "Eesti Rahvuslased ja Konservatiivid (ERK)": {
    id: "erk",
    name: "Eesti Rahvuslased ja Konservatiivid",
    shortName: "ERK",
    color: "#1E3A5F",
  },
  "Erakond KOOS": {
    id: "koos",
    name: "Erakond KOOS",
    shortName: "KOOS",
    color: "#7F1D1D",
  },
  "Vabaerakond Aru Pähe": {
    id: "aru-pahe",
    name: "Vabaerakond Aru Pähe",
    shortName: "Aru Pähe",
    color: "#57534E",
  },
  "Eesti Rahvusliberaalid - Vabaerakond": {
    id: "rahvusliberaalid-vabaerakond",
    name: "Eesti Rahvusliberaalid – Vabaerakond",
    shortName: "ERL-Vabaerakond",
    color: "#52525B",
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
  const known = PARTY_PRESENTATION[sourceName];
  if (known) return known;
  const sourceSlug = slug(sourceName) || `party-${sourceIndex}`;
  return {
    id: `source-${sourceSlug}`,
    name: sourceName,
    shortName: sourceName,
    color: FALLBACK_PARTY_COLOR,
  };
}
