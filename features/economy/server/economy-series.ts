import type { EconomyGroupId } from "../../../lib/economy-types.ts";

export type PxSelection = {
  code: string;
  selection: {
    filter: "item" | "top" | "all";
    values: string[];
  };
};

export type EconomyTableDefinition = {
  groupId: EconomyGroupId;
  tableId: string;
  title: string;
  apiUrl: string;
  tableUrl: string;
  catalogUrl: string;
  dimensions: string[];
  requiredLabels: Record<string, Record<string, string>>;
  query: PxSelection[];
};

const STAT_API = "https://andmed.stat.ee/api/v1/et/stat";
const TRADE_API = "https://andmed.stat.ee/api/v1/et/statsql";
const TABLE_PAGE = "https://andmed.stat.ee/et/stat";

export const ECONOMY_TABLES = {
  prices: {
    groupId: "prices",
    tableId: "IA002",
    title: "TARBIJAHINNAINDEKS, 1997 = 100 (KUUD)",
    apiUrl: `${STAT_API}/IA002`,
    tableUrl: `${TABLE_PAGE}/IA002`,
    catalogUrl: `${STAT_API}/majandus/hinnad`,
    dimensions: ["Aasta", "Kaubagrupp", "Kuu"],
    requiredLabels: {
      Kaubagrupp: {
        "1": "Kokku",
        "2": "Toit ja mittealkohoolsed joogid",
        "5": "Eluase",
        "8": "Transport",
      },
    },
    query: [
      { code: "Aasta", selection: { filter: "top", values: ["3"] } },
      { code: "Kaubagrupp", selection: { filter: "item", values: ["1", "2", "5", "8"] } },
      { code: "Kuu", selection: { filter: "all", values: ["*"] } },
    ],
  },
  income: {
    groupId: "income",
    tableId: "PA113",
    title: "KESKMINE BRUTOKUUPALK JA MEDIAAN TEGEVUSALA JÄRGI (KVARTALID)",
    apiUrl: `${STAT_API}/PA113`,
    tableUrl: `${TABLE_PAGE}/PA113`,
    catalogUrl: `${STAT_API}/majandus/palk-ja-toojeukulu/palk/luhiajastatistika`,
    dimensions: ["Näitaja", "Tegevusala", "Vaatlusperiood"],
    requiredLabels: {
      Näitaja: {
        GR_W_AVG: "Keskmine brutokuupalk, eurot",
        GR_W_D5: "Brutokuupalga mediaan (V detsiil), eurot",
      },
      Tegevusala: { TOTAL: "Kokku – kõik tegevusalad" },
    },
    query: [
      { code: "Näitaja", selection: { filter: "item", values: ["GR_W_AVG", "GR_W_D5"] } },
      { code: "Tegevusala", selection: { filter: "item", values: ["TOTAL"] } },
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["9"] } },
    ],
  },
  work: {
    groupId: "work",
    tableId: "TT3300",
    title: "15-AASTASTE JA VANEMATE HÕIVESEISUND (KVARTALID)",
    apiUrl: `${STAT_API}/TT3300`,
    tableUrl: `${TABLE_PAGE}/TT3300`,
    catalogUrl: `${STAT_API}/sotsiaalelu/tooturg/tooturu-uldandmed/luhiajastatistika`,
    dimensions: ["Näitaja", "Sugu", "Vanuserühm", "Vaatlusperiood"],
    requiredLabels: {
      Näitaja: { EMPRATE: "Tööhõive määr, %", UNEMP_RATE: "Töötuse määr, %" },
      Sugu: { T: "Kokku" },
      Vanuserühm: { "Y15-74": "15 kuni 74 aastat" },
    },
    query: [
      { code: "Näitaja", selection: { filter: "item", values: ["EMPRATE", "UNEMP_RATE"] } },
      { code: "Sugu", selection: { filter: "item", values: ["T"] } },
      { code: "Vanuserühm", selection: { filter: "item", values: ["Y15-74"] } },
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["9"] } },
    ],
  },
  output: {
    groupId: "output",
    tableId: "RAA0012",
    title: "SISEMAJANDUSE KOGUPRODUKT JA KOGURAHVATULU (KVARTALID)",
    apiUrl: `${STAT_API}/RAA0012`,
    tableUrl: `${TABLE_PAGE}/RAA0012`,
    catalogUrl: `${STAT_API}/majandus/rahvamajanduse-arvepidamine/sisemajanduse-koguprodukt-(skp)/pehilised-rahvamajanduse-arvepidamise-naitajad`,
    dimensions: ["Aasta", "Kvartal", "Sesoonne korrigeerimine", "Näitaja"],
    requiredLabels: {
      "Sesoonne korrigeerimine": { "2": "Sesoonselt ja tööpäevade arvuga korrigeeritud" },
      Näitaja: { "2": "SKP aheldatud väärtus (referentsaasta 2020), miljonit eurot" },
    },
    query: [
      { code: "Aasta", selection: { filter: "top", values: ["3"] } },
      { code: "Kvartal", selection: { filter: "item", values: ["I", "II", "III", "IV"] } },
      { code: "Sesoonne korrigeerimine", selection: { filter: "item", values: ["2"] } },
      { code: "Näitaja", selection: { filter: "item", values: ["2"] } },
    ],
  },
  trade: {
    groupId: "trade",
    tableId: "VKK12",
    title: "KAUPADE EKSPORT, IMPORT JA NENDE MUUTUS RIIGI JÄRGI (KUUD)",
    apiUrl: `${TRADE_API}/VKK12`,
    tableUrl: `${TABLE_PAGE}/VKK12`,
    catalogUrl: `${TRADE_API}/majandus/valiskaubandus/kaupade_vk`,
    dimensions: ["FLOW", "PART_COUNTRY", "ContentsCode", "TIME"],
    requiredLabels: {
      FLOW: { BAL: "Bilanss", EXP: "Eksport", IMP: "Import" },
      PART_COUNTRY: { TOTAL: "Kokku" },
      ContentsCode: { TRD_VAL: "Kauba väärtus, eurot", BAL_VAL: "Bilansi väärtus, eurot" },
    },
    query: [
      { code: "FLOW", selection: { filter: "item", values: ["BAL", "EXP", "IMP"] } },
      { code: "PART_COUNTRY", selection: { filter: "item", values: ["TOTAL"] } },
      { code: "ContentsCode", selection: { filter: "item", values: ["TRD_VAL", "BAL_VAL"] } },
      { code: "TIME", selection: { filter: "top", values: ["25"] } },
    ],
  },
  region: {
    groupId: "region",
    tableId: "PA117",
    title: "KESKMINE BRUTOKUUPALK JA MEDIAAN HALDUSÜKSUSE JÄRGI (KVARTALID)",
    apiUrl: `${STAT_API}/PA117`,
    tableUrl: `${TABLE_PAGE}/PA117`,
    catalogUrl: `${STAT_API}/majandus/palk-ja-toojeukulu/palk/luhiajastatistika`,
    dimensions: ["Näitaja", "Haldusüksus", "Vaatlusperiood"],
    requiredLabels: {
      Näitaja: {
        GR_W_AVG: "Keskmine brutokuupalk, eurot",
        GR_W_D5: "Brutokuupalga mediaan (V detsiil), eurot",
      },
      Haldusüksus: { EE: "Eesti", EE00870000000000: "Võru maakond" },
    },
    query: [
      { code: "Näitaja", selection: { filter: "item", values: ["GR_W_AVG", "GR_W_D5"] } },
      { code: "Haldusüksus", selection: { filter: "item", values: ["EE", "EE00870000000000"] } },
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["9"] } },
    ],
  },
} as const satisfies Record<EconomyGroupId, EconomyTableDefinition>;
