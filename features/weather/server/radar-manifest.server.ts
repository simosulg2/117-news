import { NextResponse } from "next/server";

import { OFFICIAL_RADAR_PAGE_URL } from "@/lib/radar";
import { InProcessSnapshotCache } from "@/lib/snapshot-cache";

import {
  createRadarResponse,
  staleRadarResponse,
  type RadarResponse,
} from "./radar-response";
import { loadRadarData, RADAR_REVALIDATE_SECONDS } from "./radar-source-client.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MANIFEST_CACHE_MS = RADAR_REVALIDATE_SECONDS * 1_000;
const STALE_RETRY_DELAY_MS = 30_000;

const radarSnapshotCache = new InProcessSnapshotCache<RadarResponse>(
  MANIFEST_CACHE_MS,
  STALE_RETRY_DELAY_MS,
);

async function refreshRadarResponse(): Promise<RadarResponse> {
  try {
    return createRadarResponse(await loadRadarData());
  } catch (error) {
    console.error("Radar timeline fetch failed", error);
    throw error;
  }
}

export async function handleRadarGet() {
  try {
    const snapshot = await radarSnapshotCache.get(refreshRadarResponse);
    const response = snapshot.status === "stale-if-error"
      ? staleRadarResponse(snapshot.value)
      : snapshot.value;
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
        "X-Radar-Snapshot": snapshot.status,
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Radariandmeid ei õnnestunud praegu laadida.",
        source: { pageUrl: OFFICIAL_RADAR_PAGE_URL },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Radar-Snapshot": "unavailable",
        },
        status: 502,
      },
    );
  }
}
