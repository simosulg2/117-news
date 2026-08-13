export const OFFICIAL_RADAR_PAGE_URL = "https://www.ilmateenistus.ee/ilm/ilmavaatlused/radar/";
export const OFFICIAL_RADAR_WMS_URL = "https://ilmgs.envir.ee/geoserver/ilm/wms";
export const OFFICIAL_RADAR_OBSERVED_TILE_URL =
  "https://ilmtiles.envir.ee/tiles/ilm/cmp_cap/{TIME}/{z}/{x}/{-y}.png";
export const OFFICIAL_RADAR_BASE_TILE_URL =
  "https://tiles.envir.ee/tm/tms/1.0.0/ilmateenistus-radar@LEST/{z}/{x}/{-y}.png";
export const OFFICIAL_RADAR_LABEL_TILE_URL =
  "https://tiles.envir.ee/tm/tms/1.0.0/ilmateenistus-kohanimed@LEST/{z}/{x}/{-y}.png";
export const OFFICIAL_RADAR_CAPABILITIES_URL =
  `${OFFICIAL_RADAR_WMS_URL}?service=WMS&version=1.1.1&request=GetCapabilities`;

export const RADAR_FRAME_INTERVAL_MINUTES = 5;
export const RADAR_OBSERVED_FRAME_LIMIT = 36;
export const RADAR_FORECAST_FRAME_LIMIT = 18;
export const RADAR_STALE_AFTER_MINUTES = 30;

export type RadarFrameKind = "observed" | "forecast";

export type RadarFrame = {
  time: string;
  kind: RadarFrameKind;
};

export type RadarPageMetadata = {
  observedTimes: string[];
  observedCount: number;
  forecastCount: number;
  /** Exact valid times advertised by the official nowcasting WMS layer. */
  forecastTimes?: string[];
  intervalMinutes: number;
};

export type RadarTimeline = {
  frames: RadarFrame[];
  latestObservation: string;
  forecastStartsAt: string | null;
  intervalMinutes: number;
};

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function normalizeTimes(values: unknown[]): string[] {
  const timestamps = new Set<number>();

  for (const value of values) {
    if (typeof value !== "string") continue;
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) continue;
    timestamps.add(timestamp);
  }

  return [...timestamps]
    .sort((left, right) => left - right)
    .map((timestamp) => new Date(timestamp).toISOString());
}

function parseEmbeddedTimes(pageHtml: string): string[] {
  const jsonMatch = pageHtml.match(/_var\["ExistsTimes"\]\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (jsonMatch) {
    try {
      const value: unknown = JSON.parse(jsonMatch[1]);
      if (Array.isArray(value)) return normalizeTimes(value);
    } catch {
      // Fall through to the older pipe-separated page variable.
    }
  }

  const pipeMatch = pageHtml.match(/\bvar\s+ExistsTimes\s*=\s*"([^"]*)"\s*;/);
  return pipeMatch ? normalizeTimes(pipeMatch[1].split("|")) : [];
}

function decodeNoticeText(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    auml: "ä",
    gt: ">",
    lt: "<",
    nbsp: " ",
    ouml: "ö",
    otilde: "õ",
    quot: '"',
    uuml: "ü",
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (entity, codePoint: string) => {
      const value = Number.parseInt(codePoint, 16);
      return Number.isSafeInteger(value) && value >= 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : entity;
    })
    .replace(/&#([0-9]+);/g, (entity, codePoint: string) => {
      const value = Number.parseInt(codePoint, 10);
      return Number.isSafeInteger(value) && value >= 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : entity;
    })
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts only named-radar operational warnings from visible official-page
 * text. Script/style content and arbitrary upstream markup never reach the UI.
 */
export function parseOfficialRadarNotices(pageHtml: string): string[] {
  const visibleText = decodeNoticeText(
    pageHtml
      .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
  const warningPattern =
    /(?:Harku|Sürgavere)\s+(?:ilma)?radar\b[^.!?]{0,320}?(?:ei\s+tööta|tehnilis\w*\s+probleem\w*|rik\w*|hooldus\w*|katkest\w*|häire\w*)[^.!?]{0,160}[.!?]?/giu;

  return [...visibleText.matchAll(warningPattern)]
    .map((match) => match[0].replace(/\s+/g, " ").trim().slice(0, 320))
    .filter((notice, index, notices) => notice.length > 0 && notices.indexOf(notice) === index)
    .slice(0, 3);
}

function inferIntervalMinutes(times: string[]): number {
  const differences = times
    .slice(1)
    .map((time, index) => (Date.parse(time) - Date.parse(times[index])) / 60_000)
    .filter((difference) => Number.isInteger(difference) && difference >= 1 && difference <= 15)
    .sort((left, right) => left - right);

  if (differences.length === 0) return RADAR_FRAME_INTERVAL_MINUTES;
  return differences[Math.floor(differences.length / 2)];
}

/**
 * Parses only the small, public timeline configuration emitted by the official
 * radar page. It deliberately ignores arbitrary URLs and layer configuration
 * from the upstream HTML.
 */
export function parseOfficialRadarPage(pageHtml: string): RadarPageMetadata {
  const observedTimes = parseEmbeddedTimes(pageHtml);
  if (observedTimes.length === 0) throw new Error("Official radar timeline is missing");

  let sliderConfiguration: Record<string, unknown> = {};
  const sliderMatch = pageHtml.match(/_var\["sliderConf"\]\s*=\s*(\{[^;]*\})\s*;/);
  if (sliderMatch) {
    try {
      const value: unknown = JSON.parse(sliderMatch[1]);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        sliderConfiguration = value as Record<string, unknown>;
      }
    } catch {
      // Defaults below mirror the official three-hour plus 90-minute window.
    }
  }

  return {
    observedTimes,
    observedCount: clampInteger(
      sliderConfiguration.radarImagesCount,
      RADAR_OBSERVED_FRAME_LIMIT,
      1,
      RADAR_OBSERVED_FRAME_LIMIT,
    ),
    forecastCount: clampInteger(
      sliderConfiguration.nowcastImagesCount,
      RADAR_FORECAST_FRAME_LIMIT,
      0,
      RADAR_FORECAST_FRAME_LIMIT,
    ),
    intervalMinutes: inferIntervalMinutes(observedTimes),
  };
}

/** Extracts a layer's advertised time dimension for a defensive page-parser fallback. */
export function parseWmsLayerTimes(capabilitiesXml: string, layerName: string): string[] {
  const escapedName = layerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const layerMatch = capabilitiesXml.match(
    new RegExp(
      `<Layer(?:\\s[^>]*)?>[\\s\\S]*?<Name>(?:[^<]+:)?${escapedName}<\\/Name>[\\s\\S]*?<Extent[^>]+name=["']time["'][^>]*>([\\s\\S]*?)<\\/Extent>`,
      "i",
    ),
  );

  if (!layerMatch) return [];
  return normalizeTimes(layerMatch[1].split(",").map((time) => time.trim()));
}

export function buildRadarTimeline(metadata: RadarPageMetadata): RadarTimeline {
  const observedTimes = normalizeTimes(metadata.observedTimes).slice(
    -clampInteger(metadata.observedCount, RADAR_OBSERVED_FRAME_LIMIT, 1, RADAR_OBSERVED_FRAME_LIMIT),
  );
  if (observedTimes.length === 0) throw new Error("No valid radar observations available");

  const intervalMinutes = clampInteger(
    metadata.intervalMinutes,
    RADAR_FRAME_INTERVAL_MINUTES,
    1,
    15,
  );
  const forecastCount = clampInteger(
    metadata.forecastCount,
    RADAR_FORECAST_FRAME_LIMIT,
    0,
    RADAR_FORECAST_FRAME_LIMIT,
  );
  const latestObservation = observedTimes.at(-1) as string;
  const latestTimestamp = Date.parse(latestObservation);
  const observedFrames: RadarFrame[] = observedTimes.map((time) => ({ time, kind: "observed" }));
  const advertisedForecastTimes = new Set(normalizeTimes(metadata.forecastTimes ?? []));
  const forecastFrames: RadarFrame[] = Array.from({ length: forecastCount }, (_, index) =>
    new Date(latestTimestamp + (index + 1) * intervalMinutes * 60_000).toISOString(),
  )
    .filter((time) => advertisedForecastTimes.has(time))
    .map((time) => ({ time, kind: "forecast" }));

  return {
    frames: [...observedFrames, ...forecastFrames],
    latestObservation,
    forecastStartsAt: forecastFrames[0]?.time ?? null,
    intervalMinutes,
  };
}

export function isRadarStale(latestObservation: string, nowMs = Date.now()): boolean {
  const latestTimestamp = Date.parse(latestObservation);
  return !Number.isFinite(latestTimestamp) || nowMs - latestTimestamp > RADAR_STALE_AFTER_MINUTES * 60_000;
}
