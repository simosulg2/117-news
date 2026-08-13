import type {
  PoliticalFinancePeriod,
  PoliticalFinanceRecordType,
  PoliticalFinanceUnavailableResponse,
} from "../../../lib/political-finance-types";
import { getPoliticalFinanceOverview } from "./political-finance-overview.server.ts";
import {
  getPoliticalFinanceRecords,
  PoliticalFinanceRecordsNotFoundError,
  PoliticalFinanceRecordsQueryError,
} from "./political-finance-records.server.ts";

function errorResponse(message: string, status: number): Response {
  const body: PoliticalFinanceUnavailableResponse = { error: message };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function safeError(error: unknown): { name: string; code?: string } {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    code: error && typeof error === "object" && "code" in error ? String(error.code).slice(0, 40) : undefined,
  };
}

export async function handlePoliticalFinanceGet(): Promise<Response> {
  try {
    const body = await getPoliticalFinanceOverview();
    return Response.json(body, {
      headers: { "Cache-Control": body.source.status === "ok"
        ? "public, max-age=300, s-maxage=21600, stale-while-revalidate=43200" : "no-store" },
    });
  } catch (error) {
    console.error("Failed to load political finance overview", safeError(error));
    return errorResponse("Erakondade rahastamise andmete laadimine ebaõnnestus.", 502);
  }
}

function positiveInteger(value: string | null, fallback: number, maximum: number): number | null {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export async function handlePoliticalFinanceRecordsGet(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const partyId = params.get("party")?.trim() ?? "";
  const period = params.get("period")?.trim() ?? "";
  const type = params.get("type")?.trim() ?? "donations";
  const category = params.get("category")?.trim() || null;
  const page = positiveInteger(params.get("page"), 1, 10_000);
  const pageSize = positiveInteger(params.get("pageSize"), 25, 50);
  const periodYear = Number(period.slice(0, 4));
  if (!/^[a-z0-9-]{1,60}$/.test(partyId)
    || !/^\d{4}-Q[1-4]$/.test(period)
    || !Number.isInteger(periodYear) || periodYear < 2013 || periodYear > new Date().getUTCFullYear() + 1
    || !["donations", "income", "expenses"].includes(type)
    || (category !== null && !/^[a-z0-9-]{1,80}$/.test(category))
    || page === null || pageSize === null) {
    return errorResponse("Vigased rahastamisandmete päringuparameetrid.", 400);
  }
  try {
    const body = await getPoliticalFinanceRecords({
      partyId,
      period: period as PoliticalFinancePeriod,
      recordType: type as PoliticalFinanceRecordType,
      category,
      page,
      pageSize,
    });
    return Response.json(body, { headers: { "Cache-Control": body.source.status === "ok"
      ? "public, max-age=300, s-maxage=21600, stale-while-revalidate=43200" : "no-store" } });
  } catch (error) {
    if (error instanceof PoliticalFinanceRecordsQueryError) {
      return errorResponse("Tundmatu erakond.", 400);
    }
    if (error instanceof PoliticalFinanceRecordsNotFoundError) {
      return errorResponse("Selle perioodi ERJK aruannet ei leitud.", 404);
    }
    console.error("Failed to load political finance records", safeError(error));
    return errorResponse("ERJK aruande kirjete laadimine ebaõnnestus.", 502);
  }
}
