import {
  isRadarStale,
  OFFICIAL_RADAR_CAPABILITIES_URL,
  OFFICIAL_RADAR_BASE_TILE_URL,
  OFFICIAL_RADAR_LABEL_TILE_URL,
  OFFICIAL_RADAR_OBSERVED_TILE_URL,
  OFFICIAL_RADAR_PAGE_URL,
  OFFICIAL_RADAR_WMS_URL,
  type RadarTimeline,
} from "@/lib/radar";

export type RadarLoadResult = {
  timeline: RadarTimeline;
  notices: string[];
};

export type RadarResponse = {
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
    projection: "EPSG:3301";
    baseTileUrlTemplate: string;
    labelTileUrlTemplate: string;
    observedTileUrlTemplate: string;
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

export function uniqueRadarNotices(notices: readonly string[]): string[] {
  return notices.filter(
    (notice, index) => notice.length > 0 && notices.indexOf(notice) === index,
  );
}

export function createRadarResponse({ timeline, notices }: RadarLoadResult): RadarResponse {
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
      initialZoom: 2,
      projection: "EPSG:3301",
      baseTileUrlTemplate: OFFICIAL_RADAR_BASE_TILE_URL,
      labelTileUrlTemplate: OFFICIAL_RADAR_LABEL_TILE_URL,
      observedTileUrlTemplate: OFFICIAL_RADAR_OBSERVED_TILE_URL,
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

export function staleRadarResponse(response: RadarResponse): RadarResponse {
  return {
    ...response,
    stale: true,
    degraded: true,
    notices: uniqueRadarNotices([
      ...response.notices,
      "Radari oleku uuendamine ebaõnnestus; kuvatakse viimast õnnestunud ajajoont.",
    ]),
  };
}
