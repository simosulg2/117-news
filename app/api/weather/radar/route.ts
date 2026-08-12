import { NextResponse } from "next/server";

import {
  buildRadarTimeline,
  isRadarStale,
  OFFICIAL_RADAR_CAPABILITIES_URL,
  OFFICIAL_RADAR_PAGE_URL,
  OFFICIAL_RADAR_WMS_URL,
  parseOfficialRadarNotices,
  parseOfficialRadarPage,
  parseWmsLayerTimes,
  RADAR_FORECAST_FRAME_LIMIT,
  RADAR_FRAME_INTERVAL_MINUTES,
  RADAR_OBSERVED_FRAME_LIMIT,
  type RadarPageMetadata,
  type RadarTimeline,
} from "@/lib/radar";

export const dynamic = "force-dynamic";
export const revalidate = 240;

const RESPONSE_CACHE_CONTROL = "public, s-maxage=240, stale-while-revalidate=900";
const UPSTREAM_TIMEOUT_MS = 8_000;
const MANIFEST_CACHE_MS = revalidate * 1_000;

type RadarResponse = {
  generatedAt: string;
  stale: boolean;
  degraded: boolean;
  notices: string[];
  frames: RadarTimeline["frames"];
  latestObservation: string;
  forecastStartsAt: string | null;
  intervalMinutes: number;
  map: {
    center: { latitude: number; longitude: number };
    initialZoom: number;
    wmsUrl: string;
    observed: { layer: string; style: string };
    forecast: { layer: string; style: string };
  };
  source: {
    name: string;
    pageUrl: string;
    dataUrl: string;
    attribution: string;
    license: string;
  };
};

type RadarLoadResult = {
  timeline: RadarTimeline;
  notices: string[];
};

let lastSuccessfulResponse: RadarResponse | null = null;
let inFlightRadarLoad: Promise<RadarLoadResult> | null = null;

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "117.ee weather radar (+https://117.ee/ilm)",
      },
      next: { revalidate },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Radar source returned ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueNotices(notices: string[]): string[] {
  return notices.filter(
    (notice, index) => notice.length > 0 && notices.indexOf(notice) === index,
  );
}

async function loadRadarData(): Promise<RadarLoadResult> {
  const [pageResult, capabilitiesResult] = await Promise.allSettled([
    fetchText(OFFICIAL_RADAR_PAGE_URL),
    fetchText(OFFICIAL_RADAR_CAPABILITIES_URL),
  ]);
  const errors: unknown[] = [];
  const notices: string[] = [];
  let pageMetadata: RadarPageMetadata | null = null;

  if (pageResult.status === "fulfilled") {
    notices.push(...parseOfficialRadarNotices(pageResult.value));
    try {
      pageMetadata = parseOfficialRadarPage(pageResult.value);
    } catch (error) {
      errors.push(error);
    }
  } else {
    errors.push(pageResult.reason);
    notices.push("Ametliku radarilehe olekuteateid ei õnnestunud kontrollida.");
  }

  let capabilitiesObservedTimes: string[] = [];
  let advertisedForecastTimes: string[] = [];
  if (capabilitiesResult.status === "fulfilled") {
    capabilitiesObservedTimes = parseWmsLayerTimes(capabilitiesResult.value, "cmp_cap");
    advertisedForecastTimes = parseWmsLayerTimes(capabilitiesResult.value, "nowcasting");
    if (capabilitiesObservedTimes.length === 0) {
      errors.push(new Error("Official radar WMS has no observation times"));
    }
  } else {
    errors.push(capabilitiesResult.reason);
  }

  const observedTimes = pageMetadata?.observedTimes.length
    ? pageMetadata.observedTimes
    : capabilitiesObservedTimes;
  if (observedTimes.length === 0) {
    throw new AggregateError(errors, "Official radar services are unavailable");
  }

  const metadata: RadarPageMetadata = {
    observedTimes,
    observedCount: pageMetadata?.observedCount ?? RADAR_OBSERVED_FRAME_LIMIT,
    forecastCount: pageMetadata?.forecastCount ?? RADAR_FORECAST_FRAME_LIMIT,
    forecastTimes: advertisedForecastTimes,
    intervalMinutes: pageMetadata?.intervalMinutes ?? RADAR_FRAME_INTERVAL_MINUTES,
  };
  const timeline = buildRadarTimeline(metadata);
  const availableForecastCount = timeline.frames.filter(
    (frame) => frame.kind === "forecast",
  ).length;

  if (metadata.forecastCount > 0) {
    if (capabilitiesResult.status === "rejected") {
      notices.push(
        "Radari lühiprognoosi saadavust ei õnnestunud kontrollida; kuvatakse ainult mõõdetud kaadreid.",
      );
    } else if (availableForecastCount === 0) {
      notices.push("Ametlik radariteenus ei ole praegu lühiprognoosi kaadreid avaldanud.");
    } else if (availableForecastCount < metadata.forecastCount) {
      notices.push(
        `Ametlik lühiprognoos on osaliselt saadaval (${availableForecastCount}/${metadata.forecastCount} kaadrit).`,
      );
    }
  }

  return { timeline, notices: uniqueNotices(notices) };
}

function loadRadarDataOnce(): Promise<RadarLoadResult> {
  if (!inFlightRadarLoad) {
    inFlightRadarLoad = loadRadarData().finally(() => {
      inFlightRadarLoad = null;
    });
  }
  return inFlightRadarLoad;
}

function createResponse({ timeline, notices }: RadarLoadResult): RadarResponse {
  return {
    generatedAt: new Date().toISOString(),
    stale: isRadarStale(timeline.latestObservation),
    degraded: notices.length > 0,
    notices,
    frames: timeline.frames,
    latestObservation: timeline.latestObservation,
    forecastStartsAt: timeline.forecastStartsAt,
    intervalMinutes: timeline.intervalMinutes,
    map: {
      center: { latitude: 57.8463, longitude: 27.0195 },
      initialZoom: 7,
      wmsUrl: OFFICIAL_RADAR_WMS_URL,
      observed: { layer: "ilm:cmp_cap", style: "ilm:opera_radar_talv" },
      forecast: { layer: "ilm:nowcasting", style: "ilm:opera_radar" },
    },
    source: {
      name: "Keskkonnaagentuur",
      pageUrl: OFFICIAL_RADAR_PAGE_URL,
      dataUrl: OFFICIAL_RADAR_CAPABILITIES_URL,
      attribution: "Radariandmed: Keskkonnaagentuur",
      license: "CC BY 4.0",
    },
  };
}

export async function GET() {
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
    const response = createResponse(await loadRadarDataOnce());
    lastSuccessfulResponse = response;
    return NextResponse.json(response, { headers: { "Cache-Control": RESPONSE_CACHE_CONTROL } });
  } catch (error) {
    console.error("Radar timeline fetch failed", error);

    if (lastSuccessfulResponse) {
      const notices = uniqueNotices([
        ...lastSuccessfulResponse.notices,
        "Radari oleku uuendamine ebaõnnestus; kuvatakse viimast õnnestunud ajajoont.",
      ]);
      return NextResponse.json(
        { ...lastSuccessfulResponse, stale: true, degraded: true, notices },
        {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=900" },
          status: 200,
        },
      );
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
