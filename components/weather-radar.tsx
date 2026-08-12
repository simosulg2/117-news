"use client";

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isRadarStale, type RadarFrame } from "@/lib/radar";

type RadarManifest = {
  generatedAt: string;
  stale: boolean;
  degraded: boolean;
  notices: string[];
  frames: RadarFrame[];
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

type Point = { x: number; y: number };
type Coordinates = { latitude: number; longitude: number };
type MapSize = { width: number; height: number };
type MapTile = { key: string; url: string; left: number; top: number };
type ActiveRadarImage = { frame: RadarFrame; url: string; viewKey: string };

const TILE_SIZE = 256;
const WEB_MERCATOR_LIMIT = 20_037_508.342789244;
const MAX_MERCATOR_LATITUDE = 85.05112878;
const MIN_ZOOM = 5;
const MAX_ZOOM = 10;
const RADAR_REFRESH_MS = 5 * 60_000;
const RADAR_FRESHNESS_CLOCK_MS = 30_000;
const ANIMATION_FRAME_HOLD_MS = 850;
const WHEEL_ZOOM_DEBOUNCE_MS = 140;
const ZERO_POINT: Point = { x: 0, y: 0 };
const VORU_COORDINATES: Coordinates = { latitude: 57.8463, longitude: 27.0195 };
const OFFICIAL_RADAR_FALLBACK = "https://www.ilmateenistus.ee/ilm/ilmavaatlused/radar/";

const timeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

const exactTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

const precipitationLegend = [
  { value: "0,05", color: "#86c8ff" },
  { value: "0,1", color: "#18a9ff" },
  { value: "0,3", color: "#00d7d7" },
  { value: "0,5", color: "#00df72" },
  { value: "1", color: "#a9e900" },
  { value: "2", color: "#ffe000" },
  { value: "4", color: "#ff9d00" },
  { value: "8", color: "#ff4b18" },
  { value: "16", color: "#df163d" },
  { value: "50", color: "#c026d3" },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

function project(coordinates: Coordinates, zoom: number): Point {
  const size = worldSize(zoom);
  const latitude = clamp(coordinates.latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
  const sine = Math.sin((latitude * Math.PI) / 180);

  return {
    x: ((coordinates.longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size,
  };
}

function unproject(point: Point, zoom: number): Coordinates {
  const size = worldSize(zoom);
  const longitude = (point.x / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / size;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));

  return {
    latitude: clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE),
    longitude: ((longitude + 540) % 360) - 180,
  };
}

function worldPointToMercator(point: Point, zoom: number): Point {
  const size = worldSize(zoom);
  return {
    x: (point.x / size) * WEB_MERCATOR_LIMIT * 2 - WEB_MERCATOR_LIMIT,
    y: WEB_MERCATOR_LIMIT - (point.y / size) * WEB_MERCATOR_LIMIT * 2,
  };
}

function visibleTiles(center: Coordinates, zoom: number, size: MapSize): MapTile[] {
  if (size.width <= 0 || size.height <= 0) return [];

  const projectedCenter = project(center, zoom);
  const leftEdge = projectedCenter.x - size.width / 2;
  const topEdge = projectedCenter.y - size.height / 2;
  const firstX = Math.floor(leftEdge / TILE_SIZE);
  const lastX = Math.floor((leftEdge + size.width) / TILE_SIZE);
  const firstY = Math.floor(topEdge / TILE_SIZE);
  const lastY = Math.floor((topEdge + size.height) / TILE_SIZE);
  const tileCount = 2 ** zoom;
  const tiles: MapTile[] = [];

  for (let tileY = firstY; tileY <= lastY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = firstX; tileX <= lastX; tileX += 1) {
      const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}/${tileX}/${tileY}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${tileY}.png`,
        left: tileX * TILE_SIZE - leftEdge,
        top: tileY * TILE_SIZE - topEdge,
      });
    }
  }

  return tiles;
}

function wmsImageUrl(
  manifest: RadarManifest,
  frame: RadarFrame,
  center: Coordinates,
  zoom: number,
  size: MapSize,
): string {
  if (size.width <= 0 || size.height <= 0) return "";

  const projectedCenter = project(center, zoom);
  const topLeft = worldPointToMercator(
    { x: projectedCenter.x - size.width / 2, y: projectedCenter.y - size.height / 2 },
    zoom,
  );
  const bottomRight = worldPointToMercator(
    { x: projectedCenter.x + size.width / 2, y: projectedCenter.y + size.height / 2 },
    zoom,
  );
  const layer = frame.kind === "forecast" ? manifest.map.forecast : manifest.map.observed;
  const url = new URL(manifest.map.wmsUrl);
  url.search = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetMap",
    LAYERS: layer.layer,
    STYLES: layer.style,
    FORMAT: "image/png",
    TRANSPARENT: "true",
    SRS: "EPSG:3857",
    BBOX: `${topLeft.x},${bottomRight.y},${bottomRight.x},${topLeft.y}`,
    WIDTH: String(Math.min(1280, Math.max(1, Math.round(size.width)))),
    HEIGHT: String(Math.min(900, Math.max(1, Math.round(size.height)))),
    TIME: frame.time,
    EXCEPTIONS: "application/vnd.ogc.se_xml",
  }).toString();
  return url.toString();
}

function pointInViewport(coordinates: Coordinates, center: Coordinates, zoom: number, size: MapSize): Point {
  const point = project(coordinates, zoom);
  const centerPoint = project(center, zoom);
  return { x: size.width / 2 + point.x - centerPoint.x, y: size.height / 2 + point.y - centerPoint.y };
}

function formatFrameTime(time: string): string {
  return timeFormatter.format(new Date(time)).replace(",", "");
}

function isRadarManifest(value: unknown): value is RadarManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<RadarManifest>;
  return (
    Array.isArray(candidate.frames) &&
    candidate.frames.length > 0 &&
    Boolean(candidate.map?.wmsUrl) &&
    Boolean(candidate.source?.pageUrl)
  );
}

export function WeatherRadar({ className = "" }: { className?: string }) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const manifestRef = useRef<RadarManifest | null>(null);
  const requestedRadarUrlRef = useRef("");
  const wheelDeltaRef = useRef(0);
  const wheelZoomTimeoutRef = useRef<number | null>(null);
  const [manifest, setManifest] = useState<RadarManifest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [opacity, setOpacity] = useState(78);
  const [mapSize, setMapSize] = useState<MapSize>({ width: 0, height: 0 });
  const [center, setCenter] = useState<Coordinates>(VORU_COORDINATES);
  const [zoom, setZoom] = useState(7);
  const [dragOffset, setDragOffset] = useState<Point>(ZERO_POINT);
  const [layerError, setLayerError] = useState(false);
  const [activeRadarImage, setActiveRadarImage] = useState<ActiveRadarImage | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());

  const loadRadar = useCallback(async () => {
    try {
      const response = await fetch("/api/weather/radar", { cache: "no-store" });
      const value: unknown = await response.json();
      if (!response.ok || !isRadarManifest(value)) {
        const message =
          value && typeof value === "object" && "error" in value && typeof value.error === "string"
            ? value.error
            : "Radari ajajoont ei õnnestunud laadida.";
        throw new Error(message);
      }

      const notices = Array.isArray(value.notices)
        ? value.notices.filter((notice): notice is string => typeof notice === "string").slice(0, 6)
        : [];
      const normalizedManifest: RadarManifest = {
        ...value,
        degraded: Boolean(value.degraded) || notices.length > 0,
        notices,
      };
      const previousManifest = manifestRef.current;
      manifestRef.current = normalizedManifest;
      setManifest(normalizedManifest);
      setCenter((current) =>
        previousManifest
          ? current
          : {
              latitude: normalizedManifest.map.center.latitude,
              longitude: normalizedManifest.map.center.longitude,
            },
      );
      setZoom((current) => (previousManifest ? current : normalizedManifest.map.initialZoom));
      setFrameIndex((current) => {
        if (!previousManifest) {
          const latestObservedIndex = normalizedManifest.frames.findLastIndex(
            (frame) => frame.kind === "observed",
          );
          return Math.max(0, latestObservedIndex);
        }

        const previousTime = previousManifest.frames[current]?.time;
        const preservedIndex = normalizedManifest.frames.findIndex(
          (frame) => frame.time === previousTime,
        );
        return preservedIndex >= 0
          ? preservedIndex
          : Math.max(
              0,
              normalizedManifest.frames.findLastIndex((frame) => frame.kind === "observed"),
            );
      });
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Radari ajajoont ei õnnestunud laadida.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRadar();
    const refresh = window.setInterval(() => void loadRadar(), RADAR_REFRESH_MS);
    return () => window.clearInterval(refresh);
  }, [loadRadar]);

  useEffect(() => {
    const freshnessClock = window.setInterval(
      () => setClockMs(Date.now()),
      RADAR_FRESHNESS_CLOCK_MS,
    );
    return () => window.clearInterval(freshnessClock);
  }, []);

  useEffect(
    () => () => {
      if (wheelZoomTimeoutRef.current !== null) {
        window.clearTimeout(wheelZoomTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const element = mapElementRef.current;
    if (!element) return;

    const updateSize = () => {
      const bounds = element.getBoundingClientRect();
      setMapSize({ width: Math.round(bounds.width), height: Math.round(bounds.height) });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [manifest]);

  const selectedFrame = manifest?.frames[frameIndex] ?? null;
  const mapTiles = useMemo(() => visibleTiles(center, zoom, mapSize), [center, mapSize, zoom]);
  const mapViewKey = useMemo(
    () =>
      `${center.latitude.toFixed(7)}:${center.longitude.toFixed(7)}:${zoom}:${mapSize.width}:${mapSize.height}`,
    [center, mapSize, zoom],
  );
  const radarUrl = useMemo(
    () => (manifest && selectedFrame ? wmsImageUrl(manifest, selectedFrame, center, zoom, mapSize) : ""),
    [center, manifest, mapSize, selectedFrame, zoom],
  );
  const radarRequest = useMemo<ActiveRadarImage | null>(
    () =>
      selectedFrame && radarUrl
        ? { frame: selectedFrame, url: radarUrl, viewKey: mapViewKey }
        : null,
    [mapViewKey, radarUrl, selectedFrame],
  );
  const voruPoint = useMemo(
    () => pointInViewport(VORU_COORDINATES, center, zoom, mapSize),
    [center, mapSize, zoom],
  );
  const forecastStartIndex = manifest?.frames.findIndex((frame) => frame.kind === "forecast") ?? -1;
  const visibleRadarImage =
    activeRadarImage?.viewKey === mapViewKey ? activeRadarImage : null;
  const displayedFrame = visibleRadarImage?.frame ?? selectedFrame;
  const layerLoading = Boolean(
    radarRequest && activeRadarImage?.url !== radarRequest.url && !layerError,
  );
  const radarIsStale = Boolean(
    manifest && (manifest.stale || isRadarStale(manifest.latestObservation, clockMs)),
  );

  useEffect(() => {
    requestedRadarUrlRef.current = radarUrl;
    setLayerError(false);
  }, [radarUrl]);

  useEffect(() => {
    if (
      !playing ||
      !manifest ||
      manifest.frames.length < 2 ||
      !radarRequest ||
      activeRadarImage?.url !== radarRequest.url
    ) {
      return;
    }

    const nextFrame = window.setTimeout(
      () => setFrameIndex((current) => (current + 1) % manifest.frames.length),
      ANIMATION_FRAME_HOLD_MS,
    );
    return () => window.clearTimeout(nextFrame);
  }, [activeRadarImage?.url, manifest, playing, radarRequest]);

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragStart = dragStartRef.current;
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;

      const centerPoint = project(center, zoom);
      setCenter(
        unproject({ x: centerPoint.x - dragOffset.x, y: centerPoint.y - dragOffset.y }, zoom),
      );
      setDragOffset(ZERO_POINT);
      dragStartRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [center, dragOffset, zoom],
  );

  const cancelDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current;
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

    setDragOffset(ZERO_POINT);
    dragStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleMapWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    wheelDeltaRef.current += event.deltaY;
    if (wheelZoomTimeoutRef.current !== null) {
      window.clearTimeout(wheelZoomTimeoutRef.current);
    }
    wheelZoomTimeoutRef.current = window.setTimeout(() => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      wheelZoomTimeoutRef.current = null;
      if (delta === 0) return;
      const direction = delta < 0 ? 1 : -1;
      setZoom((current) => clamp(current + direction, MIN_ZOOM, MAX_ZOOM));
    }, WHEEL_ZOOM_DEBOUNCE_MS);
  }, []);

  const panBy = useCallback(
    (x: number, y: number) => {
      const centerPoint = project(center, zoom);
      setCenter(unproject({ x: centerPoint.x + x, y: centerPoint.y + y }, zoom));
    },
    [center, zoom],
  );

  const handleMapKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowLeft":
        panBy(-64, 0);
        break;
      case "ArrowRight":
        panBy(64, 0);
        break;
      case "ArrowUp":
        panBy(0, -64);
        break;
      case "ArrowDown":
        panBy(0, 64);
        break;
      case "+":
      case "=":
        setZoom((current) => clamp(current + 1, MIN_ZOOM, MAX_ZOOM));
        break;
      case "-":
        setZoom((current) => clamp(current - 1, MIN_ZOOM, MAX_ZOOM));
        break;
      case "Home":
        setCenter(VORU_COORDINATES);
        setZoom(manifest?.map.initialZoom ?? 7);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  if (loading) {
    return (
      <div className={`border border-[#bccbd6] bg-[#e4ebf0] p-4 dark:border-[#294154] dark:bg-[#0d1c29] ${className}`}>
        <div className="skeleton h-[20rem] w-full sm:h-[26rem]" />
        <p className="mt-3 text-xs font-semibold text-[#526878] dark:text-[#8da1b0]">Laadin radaripilte…</p>
      </div>
    );
  }

  if (!manifest || !selectedFrame) {
    return (
      <div className={`border border-[#c96c6c] bg-[#fff1f1] p-5 dark:border-[#7b3e45] dark:bg-[#25151a] ${className}`}>
        <p className="text-sm font-bold text-[#8c1f2c] dark:text-[#ff9ca7]">{loadError ?? "Radar pole praegu saadaval."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadRadar();
            }}
            className="border border-[#8c1f2c] px-3 py-1.5 text-xs font-bold text-[#8c1f2c] hover:bg-[#8c1f2c]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c1f2c] dark:border-[#ff9ca7] dark:text-[#ff9ca7]"
          >
            Proovi uuesti
          </button>
          <a
            href={OFFICIAL_RADAR_FALLBACK}
            target="_blank"
            rel="noopener noreferrer external"
            className="border border-[#90a4b2] px-3 py-1.5 text-xs font-bold text-[#245fae] hover:bg-[#4f8cff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] dark:border-[#3b5870] dark:text-[#7db0ff]"
          >
            Ava ametlik radar ↗
          </a>
        </div>
      </div>
    );
  }

  const layerTransform: CSSProperties = { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` };
  const visibleFrame = displayedFrame ?? selectedFrame;
  const frameIsForecast = visibleFrame.kind === "forecast";

  return (
    <div className={`border border-[#bccbd6] bg-[#f6f8f9] dark:border-[#294154] dark:bg-[#091722] ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#bccbd6] px-3 py-2 dark:border-[#294154]">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`border px-2 py-0.5 text-[10px] font-extrabold tracking-[0.12em] ${
              frameIsForecast
                ? "border-[#b87313] bg-[#fff4d6] text-[#87510b] dark:border-[#c88931] dark:bg-[#2b2112] dark:text-[#ffc46b]"
                : "border-[#268369] bg-[#e4f7f0] text-[#12624f] dark:border-[#36977b] dark:bg-[#0c2822] dark:text-[#67ddb9]"
            }`}
          >
            {frameIsForecast ? "LÜHIPROGNOOS" : "MÕÕDETUD"}
          </span>
          <time
            dateTime={visibleFrame.time}
            title={exactTimeFormatter.format(new Date(visibleFrame.time))}
            className="text-sm font-extrabold tabular-nums text-[#101a24] dark:text-[#edf4f8]"
          >
            {formatFrameTime(visibleFrame.time)}
          </time>
          {layerLoading && (
            <span className="text-[10px] font-bold tracking-[0.06em] text-[#526878] dark:text-[#8da1b0]">
              LAADIN {formatFrameTime(selectedFrame.time)}
            </span>
          )}
          {radarIsStale && (
            <span className="border border-[#b54e58] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.08em] text-[#9d2733] dark:border-[#c76570] dark:text-[#ff929d]">
              ANDMED VANANENUD
            </span>
          )}
        </div>
        {loadError && <span className="text-[11px] font-semibold text-[#9d2733] dark:text-[#ff929d]">Uuendamine ebaõnnestus</span>}
      </div>

      {manifest.notices.length > 0 && (
        <div
          role="status"
          className="border-b border-[#d29a42] bg-[#fff4d6] px-3 py-2.5 text-xs text-[#70440a] dark:border-[#8d6629] dark:bg-[#2b2112] dark:text-[#ffd18c]"
        >
          <p className="font-extrabold tracking-[0.06em]">RADARITEENUSE TEADE</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 font-semibold">
            {manifest.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        ref={mapElementRef}
        role="region"
        aria-label="Interaktiivne sademeradar. Liiguta nooleklahvidega ning suurenda pluss- ja miinusklahviga."
        tabIndex={0}
        onKeyDown={handleMapKey}
        onWheel={handleMapWheel}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = dragStartRef.current;
          if (!start || start.pointerId !== event.pointerId) return;
          setDragOffset({ x: event.clientX - start.x, y: event.clientY - start.y });
        }}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        className="relative h-[20rem] cursor-grab touch-pan-y overflow-hidden bg-[#dfe9ee] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f8cff] active:cursor-grabbing dark:bg-[#162735] sm:h-[26rem]"
      >
        <div className="absolute inset-0 dark:brightness-[0.62] dark:contrast-125" style={layerTransform} aria-hidden="true">
          {mapTiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              decoding="async"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{
                position: "absolute",
                left: tile.left,
                top: tile.top,
                width: TILE_SIZE,
                height: TILE_SIZE,
                maxWidth: "none",
                userSelect: "none",
              }}
            />
          ))}
        </div>

        {visibleRadarImage && (
          <img
            key={`active-${visibleRadarImage.url}`}
            src={visibleRadarImage.url}
            alt=""
            draggable={false}
            onError={() => {
              setLayerError(true);
              setPlaying(false);
              setActiveRadarImage(null);
            }}
            style={{
              ...layerTransform,
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              maxWidth: "none",
              opacity: opacity / 100,
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        )}

        {radarRequest && activeRadarImage?.url !== radarRequest.url && (
          <img
            key={`preload-${radarRequest.url}`}
            src={radarRequest.url}
            alt=""
            aria-hidden="true"
            draggable={false}
            onLoad={() => {
              if (requestedRadarUrlRef.current !== radarRequest.url) return;
              setActiveRadarImage(radarRequest);
              setLayerError(false);
            }}
            onError={() => {
              if (requestedRadarUrlRef.current !== radarRequest.url) return;
              setLayerError(true);
              setPlaying(false);
            }}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              maxWidth: "none",
              opacity: 0,
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        )}

        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: voruPoint.x + dragOffset.x, top: voruPoint.y + dragOffset.y }}
          aria-hidden="true"
        >
          <span className="block h-3 w-3 rounded-full border-2 border-white bg-[#ef3340] shadow-[0_0_0_2px_rgba(16,26,36,0.75)]" />
          <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap bg-[#101a24]/90 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
            VÕRU
          </span>
        </div>

        <div className="absolute right-2 top-2 z-20 flex flex-col gap-px shadow-sm">
          <button
            type="button"
            aria-label="Suurenda kaarti"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setZoom((current) => clamp(current + 1, MIN_ZOOM, MAX_ZOOM))}
            disabled={zoom >= MAX_ZOOM}
            className="h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-xl font-bold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-40 dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Vähenda kaarti"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setZoom((current) => clamp(current - 1, MIN_ZOOM, MAX_ZOOM))}
            disabled={zoom <= MIN_ZOOM}
            className="h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-xl font-bold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-40 dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Keskenda kaart Võrule"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setCenter(VORU_COORDINATES);
              setZoom(manifest.map.initialZoom);
            }}
            className="mt-1 h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-[10px] font-extrabold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]"
          >
            VÕRU
          </button>
        </div>

        {layerError && (
          <div className="absolute inset-x-3 bottom-3 z-20 border border-[#b54e58] bg-[#fff1f1]/95 p-3 text-xs font-bold text-[#8c1f2c] shadow-lg dark:border-[#7b3e45] dark:bg-[#25151a]/95 dark:text-[#ff9ca7]">
            Selle aja radarikihti ei õnnestunud kuvada. Vali kõrvalkaader või ava ametlik radar.
            {visibleRadarImage && " Ekraanil püsib viimane õnnestunult laaditud kaader."}
          </div>
        )}
      </div>

      <div className="border-t border-[#bccbd6] px-3 py-3 dark:border-[#294154]">
        <div className="grid grid-cols-[auto_auto_auto_minmax(0,1fr)] items-center gap-2">
          <button
            type="button"
            aria-label="Eelmine radarikaader"
            onClick={() => {
              setPlaying(false);
              setFrameIndex((current) => Math.max(0, current - 1));
            }}
            disabled={frameIndex === 0}
            className="h-9 min-w-9 border border-[#90a4b2] px-2 text-sm font-extrabold text-[#245fae] hover:border-[#4f8cff] hover:bg-[#4f8cff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-35 dark:border-[#3b5870] dark:text-[#7db0ff]"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={playing ? "Peata radarianimatsioon" : "Käivita radarianimatsioon"}
            aria-pressed={playing}
            onClick={() => setPlaying((current) => !current)}
            className="h-9 min-w-[5.25rem] border border-[#4f8cff] bg-[#4f8cff]/10 px-3 text-xs font-extrabold text-[#245fae] hover:bg-[#4f8cff]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] dark:text-[#7db0ff]"
          >
            {playing ? "Ⅱ PEATA" : "▶ MÄNGI"}
          </button>
          <button
            type="button"
            aria-label="Järgmine radarikaader"
            onClick={() => {
              setPlaying(false);
              setFrameIndex((current) => Math.min(manifest.frames.length - 1, current + 1));
            }}
            disabled={frameIndex === manifest.frames.length - 1}
            className="h-9 min-w-9 border border-[#90a4b2] px-2 text-sm font-extrabold text-[#245fae] hover:border-[#4f8cff] hover:bg-[#4f8cff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-35 dark:border-[#3b5870] dark:text-[#7db0ff]"
          >
            ›
          </button>
          <label className="min-w-0">
            <span className="sr-only">Radarikaadri aeg</span>
            <input
              type="range"
              min={0}
              max={manifest.frames.length - 1}
              value={frameIndex}
              aria-valuetext={`${selectedFrame.kind === "forecast" ? "Lühiprognoos" : "Mõõdetud"}, ${exactTimeFormatter.format(new Date(selectedFrame.time))}`}
              onChange={(event) => {
                setPlaying(false);
                setFrameIndex(Number(event.currentTarget.value));
              }}
              className="h-9 w-full cursor-pointer accent-[#4f8cff]"
            />
          </label>
        </div>

        <div className="mt-1 flex justify-between text-[10px] font-bold tabular-nums text-[#526878] dark:text-[#8da1b0]">
          <span>{formatFrameTime(manifest.frames[0].time)}</span>
          {forecastStartIndex >= 0 && (
            <span className="text-[#87510b] dark:text-[#ffc46b]">PROGNOOS ALATES {formatFrameTime(manifest.frames[forecastStartIndex].time)}</span>
          )}
          <span>{formatFrameTime(manifest.frames.at(-1)?.time ?? selectedFrame.time)}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-[#d3dde4] pt-3 dark:border-[#24394a]">
          <div className="min-w-[15rem] flex-1">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.08em] text-[#526878] dark:text-[#8da1b0]">
              <span>Sademed mm/h</span>
              <span>Nõrk → väga tugev / rahe</span>
            </div>
            <div className="grid grid-cols-10" aria-label="Sademete tugevuse legend">
              {precipitationLegend.map((entry) => (
                <div key={entry.value} className="text-center">
                  <span className="block h-2.5" style={{ backgroundColor: entry.color }} />
                  <span className="mt-0.5 block text-[9px] tabular-nums text-[#526878] dark:text-[#8da1b0]">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#526878] dark:text-[#8da1b0]">
            Läbipaistvus
            <input
              type="range"
              min={25}
              max={100}
              value={opacity}
              aria-valuetext={`${opacity} protsenti`}
              onChange={(event) => setOpacity(Number(event.currentTarget.value))}
              className="w-24 accent-[#4f8cff]"
            />
            <span className="w-8 text-right tabular-nums">{opacity}%</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#bccbd6] px-3 py-2 text-[10px] font-semibold text-[#526878] dark:border-[#294154] dark:text-[#8da1b0]">
        <span>
          {manifest.source.attribution} · {manifest.source.license} · Kaart:{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer external"
            className="underline decoration-dotted underline-offset-2 hover:text-[#245fae] dark:hover:text-[#7db0ff]"
          >
            © OpenStreetMap contributors
          </a>
        </span>
        <a
          href={manifest.source.pageUrl}
          target="_blank"
          rel="noopener noreferrer external"
          className="font-bold text-[#245fae] underline decoration-dotted underline-offset-2 hover:text-[#174b88] dark:text-[#7db0ff] dark:hover:text-[#a8caff]"
        >
          Ava ametlik radar ↗
        </a>
      </div>
    </div>
  );
}
