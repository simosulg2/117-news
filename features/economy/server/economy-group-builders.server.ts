import {
  buildEconomyIndicator,
  deriveAnnualPercentageSeries,
  yearAgoPeriodId,
  type RawEconomyPoint,
} from "@/features/economy/model/economy-indicators";
import type { EconomyGroup, EconomyIndicator, EconomyUnit } from "@/lib/economy-types";

import { ECONOMY_TABLES } from "./economy-series";
import { codedPeriodPoints, splitMonthPoints, splitQuarterPoints } from "./economy-series-points";
import { fetchStatisticsEstoniaTable, type FetchedEconomyTable } from "./statistics-estonia.server";

const PERCENT: EconomyUnit = { id: "percent", label: "protsenti", symbol: "%", decimals: 1 };
const EURO: EconomyUnit = { id: "euro", label: "eurot", symbol: "€", decimals: 0 };
const MILLION_EURO: EconomyUnit = { id: "million-euro", label: "miljonit eurot", symbol: "mln €", decimals: 1 };

const GROUP_COPY: Record<EconomyGroup["id"], Pick<EconomyGroup, "label" | "description">> = {
  prices: { label: "Hinnad", description: "Aastane hinnamuutus tarbijahinnaindeksi põhjal." },
  income: { label: "Sissetulek", description: "Eesti brutopalkade kvartaliseis." },
  work: { label: "Tööturg", description: "15–74-aastaste hõive ja töötus." },
  output: { label: "Majanduse maht", description: "Sesoonselt korrigeeritud reaalne SKP." },
  trade: { label: "Väliskaubandus", description: "Eesti kaupade eksport, import ja bilanss." },
  region: { label: "Võrumaa", description: "Võru maakonna palgad samas tabelis Eesti näitajaga." },
};

function group(table: FetchedEconomyTable, indicators: EconomyIndicator[]): EconomyGroup {
  const copy = GROUP_COPY[indicators[0]?.groupId ?? ECONOMY_TABLES.prices.groupId];
  return { id: indicators[0]?.groupId ?? "prices", ...copy, status: "ok", indicators, source: table.source, message: null };
}

function derivedInputs(points: RawEconomyPoint[]): string[] {
  const latest = points.at(-1)?.period;
  return latest ? [latest.id, yearAgoPeriodId(latest)] : [];
}

export async function loadPricesGroup(): Promise<EconomyGroup> {
  const table = await fetchStatisticsEstoniaTable(ECONOMY_TABLES.prices);
  const definitions = [
    ["cpi-total", "Tarbijahinnad", "1", "Kõigi tarbekaupade ja teenuste aastane hinnamuutus.", "target-2"],
    ["cpi-food", "Toit ja joogid", "2", "Toidu ja mittealkohoolsete jookide aastane hinnamuutus.", "lower"],
    ["cpi-housing", "Eluase", "5", "Eluasemega seotud hindade aastane muutus.", "lower"],
    ["cpi-transport", "Transport", "8", "Transpordiga seotud hindade aastane muutus.", "lower"],
  ] as const;
  const indicators = definitions.map(([id, label, category, description, direction]) => {
    const index = splitMonthPoints(table.dataset, { Kaubagrupp: category });
    const points = deriveAnnualPercentageSeries(index);
    return buildEconomyIndicator({
      id, groupId: "prices", label, description, frequency: "monthly",
      geographyCode: "EE", geographyLabel: "Eesti", unit: PERCENT,
      priceBasis: "index-1997", seasonalAdjustment: "unadjusted", points,
      comparisonKind: "percentage-point", preferredDirection: direction, source: table.source,
      derivation: { formula: "(THI indeks / sama kuu indeks aasta varem − 1) × 100", inputPeriods: derivedInputs(points) },
    });
  });
  return group(table, indicators);
}

export async function loadIncomeGroup(): Promise<EconomyGroup> {
  const table = await fetchStatisticsEstoniaTable(ECONOMY_TABLES.income);
  const definitions = [
    ["average-gross-wage", "Keskmine brutopalk", "GR_W_AVG", "Keskmine brutokuupalk kõigil tegevusaladel."],
    ["median-gross-wage", "Mediaanbrutopalk", "GR_W_D5", "Brutokuupalga mediaan ehk V detsiil."],
  ] as const;
  return group(table, definitions.map(([id, label, indicator, description]) => buildEconomyIndicator({
    id, groupId: "income", label, description, frequency: "quarterly",
    geographyCode: "EE", geographyLabel: "Eesti", unit: EURO,
    priceBasis: "nominal", seasonalAdjustment: "unadjusted",
    points: codedPeriodPoints(table.dataset, "Vaatlusperiood", "quarterly", { Näitaja: indicator, Tegevusala: "TOTAL" }),
    comparisonKind: "percent", preferredDirection: "higher", source: table.source,
  })));
}

export async function loadWorkGroup(): Promise<EconomyGroup> {
  const table = await fetchStatisticsEstoniaTable(ECONOMY_TABLES.work);
  const definitions = [
    ["employment-rate", "Tööhõive määr", "EMPRATE", "Hõivatute osatähtsus 15–74-aastaste seas.", "higher"],
    ["unemployment-rate", "Töötuse määr", "UNEMP_RATE", "Töötute osatähtsus 15–74-aastases tööjõus.", "lower"],
  ] as const;
  return group(table, definitions.map(([id, label, indicator, description, direction]) => buildEconomyIndicator({
    id, groupId: "work", label, description, frequency: "quarterly",
    geographyCode: "EE", geographyLabel: "Eesti", unit: PERCENT,
    priceBasis: "not-applicable", seasonalAdjustment: "unadjusted",
    points: codedPeriodPoints(table.dataset, "Vaatlusperiood", "quarterly", { Näitaja: indicator, Sugu: "T", Vanuserühm: "Y15-74" }),
    comparisonKind: "percentage-point", preferredDirection: direction, source: table.source,
  })));
}

export async function loadOutputGroup(): Promise<EconomyGroup> {
  const table = await fetchStatisticsEstoniaTable(ECONOMY_TABLES.output);
  const indicator = buildEconomyIndicator({
    id: "real-gdp", groupId: "output", label: "Reaalne SKP",
    description: "Aheldatud väärtus 2020. aasta hindades; sesoonselt ja tööpäevade arvuga korrigeeritud.",
    frequency: "quarterly", geographyCode: "EE", geographyLabel: "Eesti", unit: MILLION_EURO,
    priceBasis: "chain-linked-2020", seasonalAdjustment: "seasonally-adjusted",
    points: splitQuarterPoints(table.dataset, { "Sesoonne korrigeerimine": "2", Näitaja: "2" }),
    comparisonKind: "percent", preferredDirection: "higher", source: table.source,
  });
  return group(table, [indicator]);
}

export async function loadTradeGroup(): Promise<EconomyGroup> {
  const table = await fetchStatisticsEstoniaTable(ECONOMY_TABLES.trade);
  const definitions = [
    ["goods-export", "Kaupade eksport", "EXP", "TRD_VAL", "Eestist eksporditud kaupade väärtus.", "higher", "percent"],
    ["goods-import", "Kaupade import", "IMP", "TRD_VAL", "Eestisse imporditud kaupade väärtus.", "neutral", "percent"],
    ["trade-balance", "Kaubandusbilanss", "BAL", "BAL_VAL", "Kaupade ekspordi ja impordi vahe.", "higher", "absolute"],
  ] as const;
  return group(table, definitions.map(([id, label, flow, content, description, direction, comparisonKind]) => buildEconomyIndicator({
    id, groupId: "trade", label, description, frequency: "monthly",
    geographyCode: "EE", geographyLabel: "Eesti", unit: MILLION_EURO,
    priceBasis: "nominal", seasonalAdjustment: "unadjusted",
    points: codedPeriodPoints(table.dataset, "TIME", "monthly", { FLOW: flow, PART_COUNTRY: "TOTAL", ContentsCode: content }, 1_000_000),
    comparisonKind, preferredDirection: direction, source: table.source,
  })));
}

function regionalIndicator(
  table: FetchedEconomyTable,
  id: string,
  label: string,
  indicator: string,
  description: string,
): EconomyIndicator {
  const countyPoints = codedPeriodPoints(table.dataset, "Vaatlusperiood", "quarterly", { Näitaja: indicator, Haldusüksus: "EE00870000000000" });
  const nationalPoints = codedPeriodPoints(table.dataset, "Vaatlusperiood", "quarterly", { Näitaja: indicator, Haldusüksus: "EE" });
  const result = buildEconomyIndicator({
    id, groupId: "region", label, description, frequency: "quarterly",
    geographyCode: "EE00870000000000", geographyLabel: "Võru maakond", unit: EURO,
    priceBasis: "nominal", seasonalAdjustment: "unadjusted", points: countyPoints,
    comparisonKind: "percent", preferredDirection: "higher", source: table.source,
  });
  const current = result.current;
  const benchmark = current && nationalPoints.find((point) => point.period.id === current.period.id);
  if (current && benchmark && benchmark.value !== 0) {
    result.benchmark = {
      geographyCode: "EE", geographyLabel: "Eesti", period: benchmark.period,
      value: benchmark.value, differencePercent: ((current.value / benchmark.value) - 1) * 100,
    };
  }
  return result;
}

export async function loadRegionGroup(): Promise<EconomyGroup> {
  const table = await fetchStatisticsEstoniaTable(ECONOMY_TABLES.region);
  return group(table, [
    regionalIndicator(table, "vorumaa-average-wage", "Võrumaa keskmine brutopalk", "GR_W_AVG", "Võru maakonna keskmine brutokuupalk."),
    regionalIndicator(table, "vorumaa-median-wage", "Võrumaa mediaanbrutopalk", "GR_W_D5", "Võru maakonna brutokuupalga mediaan."),
  ]);
}
