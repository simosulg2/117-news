import {
  buildRadarTimeline,
  OFFICIAL_RADAR_CAPABILITIES_URL,
  OFFICIAL_RADAR_PAGE_URL,
  parseOfficialRadarNotices,
  parseOfficialRadarPage,
  parseWmsLayerTimes,
  RADAR_FORECAST_FRAME_LIMIT,
  RADAR_FRAME_INTERVAL_MINUTES,
  RADAR_OBSERVED_FRAME_LIMIT,
  type RadarPageMetadata,
} from "@/lib/radar";

import { type RadarLoadResult, uniqueRadarNotices } from "./radar-response";
import { readBoundedResponseText } from "../../../lib/bounded-response.ts";

export const RADAR_REVALIDATE_SECONDS = 240;
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_RADAR_SOURCE_BYTES = 5_000_000;

async function fetchRadarText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "117.ee weather radar (+https://117.ee/ilm)",
      },
      next: { revalidate: RADAR_REVALIDATE_SECONDS },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Radar source returned ${response.status}`);
    return await readBoundedResponseText(response, MAX_RADAR_SOURCE_BYTES);
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadRadarData(): Promise<RadarLoadResult> {
  const [pageResult, capabilitiesResult] = await Promise.allSettled([
    fetchRadarText(OFFICIAL_RADAR_PAGE_URL),
    fetchRadarText(OFFICIAL_RADAR_CAPABILITIES_URL),
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

  return { timeline, notices: uniqueRadarNotices(notices) };
}
