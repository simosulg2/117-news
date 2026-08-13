import type { EconomyIndicator, EconomyResponse } from "../../../lib/economy-types.ts";
import type { NowCard } from "../../../lib/now-types.ts";
import type { PoliticalFinanceResponse } from "../../../lib/political-finance-types.ts";
import type { NewsResponse } from "../../../lib/types.ts";
import type { WeatherResponse } from "../../../lib/weather-types.ts";
import type { WeatherWarningsResponse } from "../../../lib/weather-warning-types.ts";
import { visibleWeatherWarnings, weatherWarningPhase } from "../../../lib/weather-warnings.ts";
import { nowFingerprint, nowTimestamp } from "./now-card-utils.ts";

export function buildNewsNowCard(data: NewsResponse): NowCard | null {
  const item = [...data.items].sort((left, right) => {
    const coverage = (right.related.length - left.related.length) * 3;
    return coverage || nowTimestamp(right.publishedAt) - nowTimestamp(left.publishedAt) || left.id.localeCompare(right.id);
  })[0];
  if (!item) return null;
  const revision = [item.title, item.summary, ...item.related.map((related) => related.id).sort()].join("|");
  return {
    id: `news:${item.id}`, revisionId: nowFingerprint(revision), area: "news",
    priority: 70 + Math.min(item.related.length, 5), happenedAt: item.publishedAt ?? data.updatedAt,
    headline: item.title,
    detail: item.related.length > 0 ? `${item.source} · ${item.related.length + 1} seotud kajastust` : `${item.source} · värske uudis`,
    targetUrl: "/", sourceUrl: item.link, sourceLabel: item.source, entityIds: [item.source],
    eventKind: "news", watchTarget: { kind: "news-source", targetId: item.source, label: `${item.source} uudised` },
  };
}

export function buildWeatherNowCard(data?: WeatherResponse, warnings?: WeatherWarningsResponse, nowMs = Date.now()): NowCard | null {
  const current = data?.current;
  const warning = warnings ? visibleWeatherWarnings(warnings.warnings, nowMs)[0] : undefined;
  if (!current && !warning) return null;
  const observed = current
    ? `${current.temperatureC === null ? "Temperatuur puudub" : `${current.temperatureC.toFixed(1)} °C`}${current.phenomenon ? ` · ${current.phenomenon}` : ""}${current.windSpeedMs === null ? "" : ` · tuul ${current.windSpeedMs.toFixed(1)} m/s`}`
    : "Vaatlus pole saadaval";
  if (warning && warnings) {
    const phase = weatherWarningPhase(warning, nowMs);
    const level = warning.level === null ? null : `Tase ${warning.level}: `;
    const phasePrefix = phase === "upcoming" ? "Tulekul · " : "";
    const phaseDetail = phase === "upcoming" ? "Tulevane ametlik hoiatus." : "Ametlik hoiatus kehtib praegu.";
    const activePriority = warning.level === null ? 84 : 78 + warning.level * 7;
    return {
      id: warning.id, revisionId: warning.revisionId, area: "weather",
      priority: phase === "upcoming" ? activePriority - 18 : activePriority,
      happenedAt: warning.validFrom ?? warnings.fetchedAt,
      headline: `${phasePrefix}${level ?? ""}${warning.phenomenon}`,
      detail: `${phaseDetail} ${warning.description} Hetkel Võrus: ${observed}.`, targetUrl: "/ilm",
      sourceUrl: warnings.source.url, sourceLabel: warnings.source.name, entityIds: ["vorumaa"],
      eventKind: "weather-warning",
      watchTarget: { kind: "weather-warning", targetId: "vorumaa", label: "Võrumaa ilmahoiatused" },
    };
  }
  return {
    id: `weather:${current!.time}`, revisionId: nowFingerprint(JSON.stringify(current)), area: "weather",
    priority: 30, happenedAt: current!.time, headline: "Võru hetkevaatlus", detail: observed,
    targetUrl: "/ilm",
    sourceUrl: data!.attributions.find((source) => source.source === "environment_agency_current")?.url ?? "https://www.ilmateenistus.ee/",
    sourceLabel: "Keskkonnaagentuur", entityIds: ["vorumaa"], eventKind: "weather-observation", watchTarget: null,
  };
}

function displayEconomyValue(indicator: EconomyIndicator): string {
  if (!indicator.current) return "Andmed puuduvad";
  const value = new Intl.NumberFormat("et-EE", {
    maximumFractionDigits: indicator.unit.decimals, minimumFractionDigits: indicator.unit.decimals,
  }).format(indicator.current.value);
  return `${value}${indicator.unit.symbol ? ` ${indicator.unit.symbol}` : ""}`;
}

export function buildEconomyNowCard(data: EconomyResponse): NowCard | null {
  const indicator = [...data.groups.flatMap((group) => group.indicators).filter((item) => item.current !== null)]
    .sort((left, right) => nowTimestamp(right.source.updatedAt) - nowTimestamp(left.source.updatedAt)
      || (right.current?.period.id ?? "").localeCompare(left.current?.period.id ?? "") || left.id.localeCompare(right.id))[0];
  if (!indicator?.current) return null;
  const comparison = indicator.yearOverYear
    ? `${indicator.yearOverYear.value > 0 ? "+" : ""}${indicator.yearOverYear.value.toFixed(1)}${indicator.yearOverYear.kind === "percentage-point" ? " pp" : "%"} aastaga`
    : "aastavõrdlus puudub";
  return {
    id: `economy:${indicator.id}:${indicator.current.period.id}`,
    revisionId: nowFingerprint(`${indicator.current.period.id}|${indicator.current.value}|${indicator.current.revision}`),
    area: "economy", priority: 52, happenedAt: indicator.source.updatedAt ?? indicator.source.retrievedAt,
    headline: `${indicator.label}: ${displayEconomyValue(indicator)}`,
    detail: `${indicator.current.period.label} · ${comparison} · ${indicator.classification.explanation}`,
    targetUrl: "/majandus", sourceUrl: indicator.source.tableUrl, sourceLabel: indicator.source.providerName,
    entityIds: [indicator.id], eventKind: "economy",
    watchTarget: { kind: "economy-indicator", targetId: indicator.id, label: indicator.label },
  };
}

const euro = new Intl.NumberFormat("et-EE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function buildFinanceNowCard(data: PoliticalFinanceResponse): NowCard | null {
  const parties = data.parties.filter((party) => party.donations !== null);
  const leader = [...parties].sort((left, right) => (right.donations ?? 0) - (left.donations ?? 0) || left.name.localeCompare(right.name, "et"))[0];
  if (!leader || leader.donations === null) return null;
  const partyMetrics = Object.fromEntries(data.parties.map((party) => [party.canonicalPartyId ?? party.id, {
    name: party.name, income: party.income, expenses: party.expenses, donations: party.donations,
    revisionId: party.filing.revisionId, sourceUrl: party.filing.sourceUrl,
  }]));
  const donorMetrics = Object.fromEntries(data.parties.flatMap((party) => party.largestDonors.filter((donor) => donor.watchable).map((donor) => [donor.id, {
    name: donor.donorName, amount: donor.amount, partyId: party.canonicalPartyId ?? party.id, partyName: party.name,
    revisionId: `${party.filing.revisionId}:${donor.id}:${donor.amount}:${donor.donationCount}`,
  }] as const)));
  const partyId = leader.canonicalPartyId ?? leader.id;
  return {
    id: `political-finance:${data.period}`, revisionId: nowFingerprint(data.parties.map((party) => party.filing.revisionId).sort().join("|")),
    area: "political-finance", priority: 50, happenedAt: data.retrievedAt,
    headline: `${leader.name}: ${euro.format(leader.donations)} annetusi`,
    detail: `${data.period} ERJK aruanded · suurim erakonna annetuste kogusumma. Deklareeritud andmed, mitte hinnang mõjule.`,
    targetUrl: "/erakonnaraha", sourceUrl: leader.filing.sourceUrl, sourceLabel: data.source.name,
    entityIds: [partyId], eventKind: "political-finance", financePartyMetrics: partyMetrics,
    financeDonorMetrics: donorMetrics,
    watchTarget: { kind: "political-finance-party", targetId: partyId, label: leader.name },
  };
}
