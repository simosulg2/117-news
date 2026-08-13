import { composeEconomyResponse } from "@/features/economy/model/economy-response";
import { InProcessSnapshotCache } from "@/lib/snapshot-cache";
import {
  ECONOMY_GROUP_IDS,
  type EconomyGroup,
  type EconomyGroupId,
  type EconomyResponse,
  type EconomyUnavailableResponse,
} from "@/lib/economy-types";

import {
  loadIncomeGroup,
  loadOutputGroup,
  loadPricesGroup,
  loadRegionGroup,
  loadTradeGroup,
  loadWorkGroup,
} from "./economy-group-builders.server";
import { ECONOMY_TABLES } from "./economy-series";
import { StatisticsEstoniaError } from "./statistics-estonia.server";

const SNAPSHOT_TTL_MS = 12 * 60 * 60 * 1_000;
const STALE_RETRY_DELAY_MS = 30 * 60 * 1_000;

const loaders: Record<EconomyGroupId, () => Promise<EconomyGroup>> = {
  prices: loadPricesGroup,
  income: loadIncomeGroup,
  work: loadWorkGroup,
  output: loadOutputGroup,
  trade: loadTradeGroup,
  region: loadRegionGroup,
};

const caches = Object.fromEntries(ECONOMY_GROUP_IDS.map((id) => [
  id,
  new InProcessSnapshotCache<EconomyGroup>(SNAPSHOT_TTL_MS, STALE_RETRY_DELAY_MS),
])) as Record<EconomyGroupId, InProcessSnapshotCache<EconomyGroup>>;

const copy: Record<EconomyGroupId, Pick<EconomyGroup, "label" | "description">> = {
  prices: { label: "Hinnad", description: "Aastane hinnamuutus tarbijahinnaindeksi põhjal." },
  income: { label: "Sissetulek", description: "Eesti brutopalkade kvartaliseis." },
  work: { label: "Tööturg", description: "15–74-aastaste hõive ja töötus." },
  output: { label: "Majanduse maht", description: "Sesoonselt korrigeeritud reaalne SKP." },
  trade: { label: "Väliskaubandus", description: "Eesti kaupade eksport, import ja bilanss." },
  region: { label: "Võrumaa", description: "Võru maakonna palgad samas tabelis Eesti näitajaga." },
};

async function cachedGroup(id: EconomyGroupId): Promise<EconomyGroup> {
  const snapshot = await caches[id].get(loaders[id]);
  if (snapshot.status !== "stale-if-error") return snapshot.value;
  return {
    ...snapshot.value,
    status: "stale",
    message: "Allika uuendamine ebaõnnestus; kuvame viimati õnnestunud seisu.",
  };
}

function failedGroup(id: EconomyGroupId, reason: unknown, retrievedAt: string): EconomyGroup {
  const definition = ECONOMY_TABLES[id];
  const rateLimited = reason instanceof StatisticsEstoniaError && reason.code === "rate-limited";
  return {
    id,
    ...copy[id],
    status: "failed",
    indicators: [],
    message: rateLimited
      ? "Statistikaamet piirab hetkel päringuid. See osa taastub järgmisel uuendusel."
      : "Selle osa ametlikke andmeid ei õnnestunud laadida.",
    source: {
      providerId: "statistics-estonia",
      providerName: "Statistikaamet",
      tableId: definition.tableId,
      tableTitle: definition.title,
      tableUrl: definition.tableUrl,
      apiUrl: definition.apiUrl,
      updatedAt: null,
      retrievedAt,
      attribution: "Statistikaamet",
      licenceName: "CC BY-SA 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      revisionPolicy: "latest-source-value",
    },
  };
}

export async function loadEconomyResponse(): Promise<EconomyResponse> {
  const results = await Promise.allSettled(ECONOMY_GROUP_IDS.map((id) => cachedGroup(id)));
  return composeEconomyResponse(results, failedGroup);
}

function safeError(error: unknown): { name: string; code?: string } {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code: error instanceof StatisticsEstoniaError ? error.code : undefined,
  };
}

export async function handleEconomyGet(): Promise<Response> {
  try {
    const body = await loadEconomyResponse();
    const degraded = body.status !== "ok";
    return Response.json(body, {
      headers: {
        "Cache-Control": degraded ? "no-store" : "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
        "X-Economy-Snapshot": body.status,
      },
    });
  } catch (error) {
    console.error("Failed to build economy response", safeError(error));
    const body: EconomyUnavailableResponse = { error: "Majandusandmete laadimine ebaõnnestus. Palun proovi hiljem uuesti." };
    return Response.json(body, {
      status: 502,
      headers: { "Cache-Control": "no-store", "X-Economy-Snapshot": "unavailable" },
    });
  }
}
