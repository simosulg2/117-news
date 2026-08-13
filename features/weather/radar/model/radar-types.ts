import type { RadarFrame } from "../../../../lib/radar.ts";

export type RadarManifest = {
  generatedAt: string;
  stale: boolean;
  degraded: boolean;
  notices: string[];
  frames: RadarFrame[];
  latestObservation: string;
  forecastStartsAt: string | null;
  intervalMinutes: number;
  map: {
    center: Coordinates;
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

export type Point = { x: number; y: number };
export type Coordinates = { latitude: number; longitude: number };
export type MapSize = { width: number; height: number };
export type MapTile = { key: string; url: string; left: number; top: number };
export type ActiveRadarImage = { frame: RadarFrame; url: string; viewKey: string };
