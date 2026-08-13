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

export type Point = { x: number; y: number };
export type Coordinates = { latitude: number; longitude: number };
export type MapSize = { width: number; height: number };
export type MapTile = { key: string; url: string; left: number; top: number };
export type RadarTileSlot = {
  key: string;
  zoom: number;
  x: number;
  y: number;
  tmsY: number;
  left: number;
  top: number;
  bbox: readonly [number, number, number, number];
};
export type RadarFrameTile = RadarTileSlot & { url: string; fallbackUrl: string | null };
export type RadarTilePlan = {
  id: string;
  frame: RadarFrame;
  tileSetKey: string;
  tiles: RadarFrameTile[];
};
