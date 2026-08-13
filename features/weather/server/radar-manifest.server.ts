import { NextResponse } from "next/server";

import { OFFICIAL_RADAR_PAGE_URL } from "@/lib/radar";

import {
  createRadarResponse,
  staleRadarResponse,
  type RadarLoadResult,
  type RadarResponse,
} from "./radar-response";
import { loadRadarData, RADAR_REVALIDATE_SECONDS } from "./radar-source-client.server";

export const dynamic = "force-dynamic";
export const revalidate = RADAR_REVALIDATE_SECONDS;

const RESPONSE_CACHE_CONTROL = "public, s-maxage=240, stale-while-revalidate=900";
const MANIFEST_CACHE_MS = revalidate * 1_000;

let lastSuccessfulResponse: RadarResponse | null = null;
let inFlightRadarLoad: Promise<RadarLoadResult> | null = null;

function loadRadarDataOnce(): Promise<RadarLoadResult> {
  if (!inFlightRadarLoad) {
    inFlightRadarLoad = loadRadarData().finally(() => {
      inFlightRadarLoad = null;
    });
  }
  return inFlightRadarLoad;
}

export async function handleRadarGet() {
  const cachedAt = lastSuccessfulResponse
    ? Date.parse(lastSuccessfulResponse.generatedAt)
    : Number.NaN;
  if (
    lastSuccessfulResponse &&
    Number.isFinite(cachedAt) &&
    Date.now() - cachedAt < MANIFEST_CACHE_MS
  ) {
    return NextResponse.json(lastSuccessfulResponse, {
      headers: { "Cache-Control": RESPONSE_CACHE_CONTROL },
    });
  }

  try {
    const response = createRadarResponse(await loadRadarDataOnce());
    lastSuccessfulResponse = response;
    return NextResponse.json(response, { headers: { "Cache-Control": RESPONSE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Radar timeline fetch failed", error);

    if (lastSuccessfulResponse) {
      return NextResponse.json(staleRadarResponse(lastSuccessfulResponse), {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=900" },
        status: 200,
      });
    }

    return NextResponse.json(
      {
        error: "Radariandmeid ei õnnestunud praegu laadida.",
        source: { pageUrl: OFFICIAL_RADAR_PAGE_URL },
      },
      { headers: { "Cache-Control": "no-store" }, status: 502 },
    );
  }
}
