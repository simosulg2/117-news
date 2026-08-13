import type {
  EconomyClassification,
  EconomyComparison,
  EconomyComparisonKind,
  EconomyFrequency,
  EconomyGroup,
  EconomyIndicator,
  EconomyObservation,
  EconomyPeriod,
  EconomyReleaseStatus,
  EconomySourceReference,
  EconomySummary,
  EconomyUnit,
} from "@/lib/economy-types";

export type RawEconomyPoint = {
  period: EconomyPeriod;
  value: number;
  sourceStatus?: string | null;
};

type NormalizedPoint = RawEconomyPoint & { revised: boolean };

export type IndicatorBuildOptions = {
  id: string;
  groupId: EconomyIndicator["groupId"];
  label: string;
  description: string;
  frequency: EconomyFrequency;
  geographyCode: string;
  geographyLabel: string;
  unit: EconomyUnit;
  priceBasis: EconomyIndicator["priceBasis"];
  seasonalAdjustment: EconomyIndicator["seasonalAdjustment"];
  points: RawEconomyPoint[];
  comparisonKind: EconomyComparisonKind;
  preferredDirection: "higher" | "lower" | "target-2" | "neutral";
  source: EconomySourceReference;
  derivation?: EconomyIndicator["derivation"];
};

function periodNumber(period: EconomyPeriod): number {
  const monthly = /^(\d{4})M(\d{2})$/.exec(period.id);
  if (monthly) return Number(monthly[1]) * 12 + Number(monthly[2]) - 1;
  const quarterly = /^(\d{4})Q([1-4])$/.exec(period.id);
  if (quarterly) return Number(quarterly[1]) * 4 + Number(quarterly[2]) - 1;
  throw new TypeError(`Unsupported economy period ${period.id}`);
}

export function previousPeriodId(period: EconomyPeriod): string {
  const monthly = /^(\d{4})M(\d{2})$/.exec(period.id);
  if (monthly) {
    const date = new Date(Date.UTC(Number(monthly[1]), Number(monthly[2]) - 2, 1));
    return `${date.getUTCFullYear()}M${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const quarterly = /^(\d{4})Q([1-4])$/.exec(period.id);
  if (quarterly) {
    const quarter = Number(quarterly[2]);
    return quarter === 1 ? `${Number(quarterly[1]) - 1}Q4` : `${quarterly[1]}Q${quarter - 1}`;
  }
  throw new TypeError(`Unsupported economy period ${period.id}`);
}

export function yearAgoPeriodId(period: EconomyPeriod): string {
  const match = /^(\d{4})(M\d{2}|Q[1-4])$/.exec(period.id);
  if (!match) throw new TypeError(`Unsupported economy period ${period.id}`);
  return `${Number(match[1]) - 1}${match[2]}`;
}

export function normalizeSeriesPoints(points: RawEconomyPoint[]): NormalizedPoint[] {
  const byPeriod = new Map<string, NormalizedPoint>();
  for (const point of points) {
    if (!Number.isFinite(point.value)) continue;
    const existing = byPeriod.get(point.period.id);
    byPeriod.set(point.period.id, {
      ...point,
      revised: Boolean(existing?.revised || (existing && existing.value !== point.value)),
    });
  }
  return [...byPeriod.values()].sort((left, right) => periodNumber(left.period) - periodNumber(right.period));
}

function releaseStatus(sourceStatus?: string | null): EconomyReleaseStatus {
  const status = sourceStatus?.toLowerCase() ?? "";
  if (status.includes("f")) return "forecast";
  if (status.includes("p")) return "provisional";
  return "published";
}

function observation(point: NormalizedPoint): EconomyObservation {
  return {
    period: point.period,
    value: point.value,
    releaseStatus: releaseStatus(point.sourceStatus),
    revision: point.revised ? "revised-in-response" : "not-detectable",
  };
}

function change(current: number, reference: number, kind: EconomyComparisonKind): number | null {
  if (kind === "percent") return reference === 0 ? null : ((current / reference) - 1) * 100;
  return current - reference;
}

function comparison(
  current: NormalizedPoint,
  reference: NormalizedPoint | undefined,
  kind: EconomyComparisonKind,
): EconomyComparison | null {
  if (!reference) return null;
  const value = change(current.value, reference.value, kind);
  return value === null ? null : { kind, value, referencePeriod: reference.period };
}

function classify(
  direction: IndicatorBuildOptions["preferredDirection"],
  current: NormalizedPoint | undefined,
  yearReference: NormalizedPoint | undefined,
  yearComparison: EconomyComparison | null,
): EconomyClassification {
  if (!current) return { outlook: "unavailable", basis: "Andmed puuduvad", explanation: "Allikas ei avalda valitud perioodi väärtust." };
  if (direction === "neutral") {
    return { outlook: "neutral", basis: "Suunda ei hinnata", explanation: "Selle näitaja tõus või langus ei ole üheselt hea ega halb." };
  }
  if (!yearReference || !yearComparison) {
    return { outlook: "neutral", basis: "Aastavõrdlus puudub", explanation: "Sama perioodi väärtust aasta eest ei ole saadaval." };
  }
  if (direction === "target-2") {
    const currentDistance = Math.abs(current.value - 2);
    const oldDistance = Math.abs(yearReference.value - 2);
    const delta = currentDistance - oldDistance;
    const outlook = Math.abs(delta) < 0.1 ? "neutral" : delta < 0 ? "improved" : "worsened";
    return { outlook, basis: "Lähedus 2% hinnastabiilsuse sihile", explanation: "Aastast hinnatõusu võrreldakse 2% orientiiriga ja sama kuu seisuga aasta eest." };
  }
  const threshold = yearComparison.kind === "absolute" ? 0.01 : 0.1;
  const movement = yearComparison.value;
  const outlook = Math.abs(movement) < threshold
    ? "neutral"
    : direction === "higher"
      ? movement > 0 ? "improved" : "worsened"
      : movement < 0 ? "improved" : "worsened";
  return {
    outlook,
    basis: direction === "higher" ? "Kõrgem on parem" : "Madalam on parem",
    explanation: "Hinnang põhineb sama perioodi muutusel võrreldes aastatagusega.",
  };
}

export function buildEconomyIndicator(options: IndicatorBuildOptions): EconomyIndicator {
  const points = normalizeSeriesPoints(options.points);
  const current = points.at(-1);
  const pointMap = new Map(points.map((point) => [point.period.id, point]));
  const previous = current ? pointMap.get(previousPeriodId(current.period)) : undefined;
  const yearReference = current ? pointMap.get(yearAgoPeriodId(current.period)) : undefined;
  const previousComparison = current ? comparison(current, previous, options.comparisonKind) : null;
  const annualComparison = current ? comparison(current, yearReference, options.comparisonKind) : null;
  const historyLimit = options.frequency === "monthly" ? 13 : 9;
  return {
    id: options.id,
    groupId: options.groupId,
    label: options.label,
    description: options.description,
    availability: current ? "available" : "not-available",
    frequency: options.frequency,
    geographyCode: options.geographyCode,
    geographyLabel: options.geographyLabel,
    unit: options.unit,
    priceBasis: options.priceBasis,
    seasonalAdjustment: options.seasonalAdjustment,
    current: current ? observation(current) : null,
    previousPeriod: previousComparison,
    yearOverYear: annualComparison,
    history: points.slice(-historyLimit).map(observation),
    classification: classify(options.preferredDirection, current, yearReference, annualComparison),
    derivation: options.derivation,
    source: options.source,
  };
}

export function deriveAnnualPercentageSeries(indexPoints: RawEconomyPoint[]): RawEconomyPoint[] {
  const points = normalizeSeriesPoints(indexPoints);
  const pointMap = new Map(points.map((point) => [point.period.id, point]));
  const derived: RawEconomyPoint[] = [];
  for (const point of points) {
    const reference = pointMap.get(yearAgoPeriodId(point.period));
    if (!reference || reference.value === 0) continue;
    derived.push({
      period: point.period,
      value: ((point.value / reference.value) - 1) * 100,
      sourceStatus: point.sourceStatus,
    });
  }
  return derived;
}

export function summarizeEconomy(groups: EconomyGroup[]): EconomySummary {
  const indicators = groups.flatMap((group) => group.indicators);
  const count = (outlook: EconomyClassification["outlook"]) =>
    indicators.filter((indicator) => indicator.classification.outlook === outlook).length;
  return {
    improved: count("improved"),
    worsened: count("worsened"),
    neutral: count("neutral"),
    unavailable: count("unavailable"),
    considered: indicators.length,
    methodology: "Suund on määratud näitajapõhiselt aastavõrdlusest; inflatsiooni kogunäitaja puhul mõõdetakse lähedust 2% orientiirile.",
  };
}
