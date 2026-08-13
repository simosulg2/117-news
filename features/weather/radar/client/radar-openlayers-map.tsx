"use client";

import { useEffect, useRef } from "react";
import ImageTile from "ol/ImageTile.js";
import OlMap from "ol/Map.js";
import View from "ol/View.js";
import { intersects } from "ol/extent.js";
import TileLayer from "ol/layer/Tile.js";
import Overlay from "ol/Overlay.js";
import Projection from "ol/proj/Projection.js";
import XYZ from "ol/source/XYZ.js";
import TileGrid from "ol/tilegrid/TileGrid.js";
import TileState from "ol/TileState.js";

import type { RadarFrame } from "@/lib/radar";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  RADAR_EXTENT,
  RADAR_RESOLUTIONS,
  TILE_SIZE,
} from "../model/radar-map-model";
import {
  mapSourceTileUrl,
  radarSourceFallbackUrl,
  radarSourceKey,
  radarSourceTileUrl,
} from "../model/radar-openlayers-model";
import { projectToLest, unprojectFromLest } from "../model/radar-projection";
import type { Coordinates, RadarManifest } from "../model/radar-types";

type RadarOpenLayersMapProps = {
  manifest: RadarManifest;
  frame: RadarFrame;
  center: Coordinates;
  zoom: number;
  minimumZoom: number;
  opacity: number;
  onViewChange: (center: Coordinates, zoom: number) => void;
  onFrameVisible: (frame: RadarFrame) => void;
  onFrameError: (frameKey: string) => void;
};

type MapRuntime = {
  map: OlMap;
  view: View;
  radarSource: XYZ;
  radarLayer: TileLayer<XYZ>;
  frame: RadarFrame;
  frameKey: string;
  fallbackUrls: Map<string, string>;
  failedTiles: Map<string, number[]>;
};

export function RadarOpenLayersMap(props: RadarOpenLayersMapProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<MapRuntime | null>(null);
  const latestRef = useRef(props);
  latestRef.current = props;

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    const marker = createVoruMarker();

    const projection = new Projection({
      code: "EPSG:3301",
      extent: [...RADAR_EXTENT],
      units: "m",
    });
    const tileGrid = new TileGrid({
      extent: [...RADAR_EXTENT],
      origin: [RADAR_EXTENT[0], RADAR_EXTENT[3]],
      resolutions: [...RADAR_RESOLUTIONS],
      tileSize: TILE_SIZE,
    });
    const createSource = (kind: "base" | "labels") => new XYZ({
      crossOrigin: "anonymous",
      projection,
      tileGrid,
      transition: 0,
      wrapX: false,
      tileUrlFunction: (coordinate) => mapSourceTileUrl(
        latestRef.current.manifest,
        kind,
        coordinate as [number, number, number],
      ),
    });
    const frame = latestRef.current.frame;
    const fallbackUrls = new Map<string, string>();
    const radarSource = new XYZ({
      crossOrigin: "anonymous",
      projection,
      tileGrid,
      transition: 0,
      wrapX: false,
      tileLoadFunction: (tile, source) => loadRadarTile(
        tile as ImageTile,
        source,
        fallbackUrls,
      ),
      tileUrlFunction: frameUrlFunction(
        latestRef.current.manifest,
        frame,
        fallbackUrls,
      ),
    });
    const radarLayer = new TileLayer({ source: radarSource, cacheSize: 512 });
    radarLayer.setOpacity(latestRef.current.opacity / 100);
    const view = new View({
      center: coordinateFromLatLon(latestRef.current.center),
      constrainResolution: true,
      extent: [...RADAR_EXTENT],
      maxZoom: MAX_ZOOM,
      minZoom: Math.max(MIN_ZOOM, latestRef.current.minimumZoom),
      projection,
      resolutions: [...RADAR_RESOLUTIONS],
      showFullExtent: false,
      zoom: latestRef.current.zoom,
    });
    const map = new OlMap({
      controls: [],
      keyboardEventTarget: target.parentElement ?? target,
      layers: [
        new TileLayer({ source: createSource("base") }),
        radarLayer,
        new TileLayer({ source: createSource("labels") }),
      ],
      maxTilesLoading: 24,
      overlays: [new Overlay({ element: marker, position: coordinateFromLatLon({ latitude: 57.8463, longitude: 27.0195 }), positioning: "center-center", stopEvent: false })],
      target,
      view,
    });
    map.getViewport().style.touchAction = "pan-y";
    map.getViewport().style.cursor = "grab";
    const runtime: MapRuntime = {
      map, view, radarSource, radarLayer, frame,
      frameKey: radarSourceKey(frame), fallbackUrls, failedTiles: new Map(),
    };
    runtimeRef.current = runtime;

    const handleTileError = (event: {
      tile: { getKey(): string; getTileCoord(): number[] };
    }) => {
      if (!belongsToCurrentFrame(event.tile.getKey(), runtime.frameKey)) return;
      const size = map.getSize();
      if (!size || !intersects(
        view.calculateExtent(size),
        tileGrid.getTileCoordExtent(event.tile.getTileCoord()),
      )) return;
      runtime.failedTiles.set(event.tile.getKey(), event.tile.getTileCoord());
      latestRef.current.onFrameError(runtime.frameKey);
    };
    radarSource.on("tileloaderror", handleTileError);
    map.on("moveend", () => {
      const nextCenter = view.getCenter();
      const nextZoom = view.getZoom();
      if (!nextCenter || nextZoom === undefined) return;
      latestRef.current.onViewChange(latLonFromCoordinate(nextCenter), nextZoom);
    });
    map.on("rendercomplete", () => {
      const size = map.getSize();
      if (!size) return;
      const viewport = view.calculateExtent(size);
      const hasVisibleFailure = [...runtime.failedTiles.values()].some(
        (coordinate) => intersects(viewport, tileGrid.getTileCoordExtent(coordinate)),
      );
      if (!hasVisibleFailure) latestRef.current.onFrameVisible(runtime.frame);
    });

    return () => {
      runtimeRef.current = null;
      map.setTarget(undefined);
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const key = radarSourceKey(props.frame);
    runtime.frame = props.frame;
    runtime.frameKey = key;
    runtime.failedTiles.clear();
    runtime.radarSource.setTileUrlFunction(
      frameUrlFunction(props.manifest, props.frame, runtime.fallbackUrls),
      key,
    );
  }, [props.frame.kind, props.frame.time, props.manifest]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.radarLayer.setOpacity(props.opacity / 100);
  }, [props.opacity]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.view.setMinZoom(Math.max(MIN_ZOOM, props.minimumZoom));
    const projected = coordinateFromLatLon(props.center);
    const current = runtime.view.getCenter();
    if (!current || Math.hypot(current[0] - projected[0], current[1] - projected[1]) > 0.1) {
      runtime.view.setCenter(projected);
    }
    if (runtime.view.getZoom() !== props.zoom) runtime.view.setZoom(props.zoom);
  }, [props.center.latitude, props.center.longitude, props.minimumZoom, props.zoom]);

  return (
    <div
      ref={targetRef}
      data-radar-frame-time={props.frame.time}
      className="absolute inset-0"
    />
  );
}

function frameUrlFunction(
  manifest: RadarManifest,
  frame: RadarFrame,
  fallbackUrls?: Map<string, string>,
) {
  return (coordinate: readonly number[] | null) => {
    const url = radarSourceTileUrl(manifest, frame, coordinate);
    const fallback = radarSourceFallbackUrl(manifest, frame, coordinate);
    if (url && fallback && fallbackUrls) {
      if (fallbackUrls.size >= 2_048) {
        const oldest = fallbackUrls.keys().next().value;
        if (oldest) fallbackUrls.delete(oldest);
      }
      fallbackUrls.set(url, fallback);
    }
    return url;
  };
}

function coordinateFromLatLon(coordinates: Coordinates): [number, number] {
  const projected = projectToLest(coordinates);
  return [projected.x, projected.y];
}

function latLonFromCoordinate(coordinates: readonly number[]): Coordinates {
  return unprojectFromLest({ x: coordinates[0], y: coordinates[1] });
}

function belongsToCurrentFrame(tileKey: string, frameKey: string): boolean {
  return tileKey.startsWith(`${frameKey}/`);
}

function loadRadarTile(
  tile: ImageTile,
  source: string,
  fallbackUrls: ReadonlyMap<string, string>,
) {
  const primary = radarImage();
  primary.onload = () => {
    if (tile.getState() === TileState.LOADING) tile.setImage(primary);
  };
  primary.onerror = () => {
    if (tile.getState() !== TileState.LOADING) return;
    const fallbackUrl = fallbackUrls.get(source);
    if (!fallbackUrl) {
      tile.setState(TileState.ERROR);
      return;
    }
    const fallback = radarImage();
    fallback.onload = () => {
      if (tile.getState() === TileState.LOADING) tile.setImage(fallback);
    };
    fallback.onerror = () => {
      if (tile.getState() === TileState.LOADING) tile.setState(TileState.ERROR);
    };
    fallback.src = fallbackUrl;
  };
  primary.src = source;
}

function radarImage(): HTMLImageElement {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.referrerPolicy = "strict-origin-when-cross-origin";
  return image;
}

function createVoruMarker(): HTMLDivElement {
  const marker = document.createElement("div");
  marker.className = "pointer-events-none";
  marker.setAttribute("aria-hidden", "true");
  const dot = document.createElement("span");
  dot.className = "block h-3 w-3 rounded-full border-2 border-white bg-[#ef3340] shadow-[0_0_0_2px_rgba(16,26,36,0.75)]";
  const label = document.createElement("span");
  label.className = "absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap bg-[#101a24]/90 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm";
  label.textContent = "VÕRU";
  marker.append(dot, label);
  return marker;
}
