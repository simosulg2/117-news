import { InvalidRiigikoguIdError, loadRiigikoguBill, loadRiigikoguVote } from "./riigikogu-detail.server";
import { loadRiigikoguOverview } from "./riigikogu-overview.server";
import { safeRiigikoguError } from "./riigikogu-source.server";
import type { RiigikoguUnavailableResponse } from "@/lib/riigikogu-types";

const PUBLIC_CACHE = "public, max-age=60, s-maxage=180, stale-while-revalidate=900";
const DETAIL_CACHE = "public, max-age=300, s-maxage=1800, stale-while-revalidate=21600";

function failure(error: unknown): Response {
  console.error("Riigikogu API request failed", safeRiigikoguError(error));
  const body: RiigikoguUnavailableResponse = { error: "Riigikogu andmete laadimine ebaõnnestus." };
  return Response.json(body, { status: error instanceof InvalidRiigikoguIdError ? 400 : 502, headers: { "Cache-Control": "no-store" } });
}

export async function handleRiigikoguOverviewGet(): Promise<Response> {
  try {
    return Response.json(await loadRiigikoguOverview(), { headers: { "Cache-Control": PUBLIC_CACHE } });
  } catch (error) { return failure(error); }
}

export async function handleRiigikoguVoteGet(id: string): Promise<Response> {
  try {
    return Response.json(await loadRiigikoguVote(id), { headers: { "Cache-Control": DETAIL_CACHE } });
  } catch (error) { return failure(error); }
}

export async function handleRiigikoguBillGet(id: string): Promise<Response> {
  try {
    return Response.json(await loadRiigikoguBill(id), { headers: { "Cache-Control": DETAIL_CACHE } });
  } catch (error) { return failure(error); }
}
