import type { CSSProperties } from "react";

import {
  MAX_ZOOM,
  MIN_ZOOM,
  TILE_SIZE,
} from "../model/radar-map-model";
import type { ReadyRadarController } from "./use-radar-controller";

export function RadarMap({ radar }: { radar: ReadyRadarController }) {
  const layerTransform: CSSProperties = {
    transform: `translate(${radar.dragOffset.x}px, ${radar.dragOffset.y}px)`,
  };

  return (
    <div
      ref={radar.mapElementRef}
      role="region"
      aria-label="Interaktiivne sademeradar. Liiguta nooleklahvidega ning suurenda pluss- ja miinusklahviga."
      tabIndex={0}
      onKeyDown={radar.handleMapKey}
      onWheel={radar.handleMapWheel}
      onPointerDown={radar.startDrag}
      onPointerMove={radar.moveDrag}
      onPointerUp={radar.finishDrag}
      onPointerCancel={radar.cancelDrag}
      className="relative h-[20rem] cursor-grab touch-pan-y overflow-hidden bg-[#dfe9ee] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f8cff] active:cursor-grabbing dark:bg-[#162735] sm:h-[26rem]"
    >
      <div className="absolute inset-0 dark:brightness-[0.62] dark:contrast-125" style={layerTransform} aria-hidden="true">
        {radar.mapTiles.map((tile) => (
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

      {radar.visibleRadarImage && (
        <img
          key={`active-${radar.visibleRadarImage.url}`}
          src={radar.visibleRadarImage.url}
          alt=""
          draggable={false}
          onError={() => radar.rejectRadarImage()}
          style={{
            ...layerTransform,
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            maxWidth: "none",
            opacity: radar.opacity / 100,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      )}

      {radar.radarRequest && radar.activeRadarImage?.url !== radar.radarRequest.url && (
        <img
          key={`preload-${radar.radarRequest.url}`}
          src={radar.radarRequest.url}
          alt=""
          aria-hidden="true"
          draggable={false}
          onLoad={() => radar.acceptRadarImage(radar.radarRequest as NonNullable<typeof radar.radarRequest>)}
          onError={() => radar.rejectRadarImage(radar.radarRequest as NonNullable<typeof radar.radarRequest>)}
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

      {radar.radarPrefetchUrls.map((url) => (
        <img
          key={`prefetch-adjacent-${url}`}
          src={url}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
        />
      ))}

      <div
        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
        style={{ left: radar.voruPoint.x + radar.dragOffset.x, top: radar.voruPoint.y + radar.dragOffset.y }}
        aria-hidden="true"
      >
        <span className="block h-3 w-3 rounded-full border-2 border-white bg-[#ef3340] shadow-[0_0_0_2px_rgba(16,26,36,0.75)]" />
        <span className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap bg-[#101a24]/90 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
          VÕRU
        </span>
      </div>

      <div className="absolute right-2 top-2 z-20 flex flex-col gap-px shadow-sm">
        <button type="button" aria-label="Suurenda kaarti" onPointerDown={(event) => event.stopPropagation()} onClick={() => radar.zoomBy(1)} disabled={radar.zoom >= MAX_ZOOM} className="h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-xl font-bold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-40 dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]">
          +
        </button>
        <button type="button" aria-label="Vähenda kaarti" onPointerDown={(event) => event.stopPropagation()} onClick={() => radar.zoomBy(-1)} disabled={radar.zoom <= MIN_ZOOM} className="h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-xl font-bold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-40 dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]">
          −
        </button>
        <button type="button" aria-label="Keskenda kaart Võrule" onPointerDown={(event) => event.stopPropagation()} onClick={radar.resetMap} className="mt-1 h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-[10px] font-extrabold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]">
          VÕRU
        </button>
      </div>

      {radar.layerError && (
        <div className="absolute inset-x-3 bottom-3 z-20 border border-[#b54e58] bg-[#fff1f1]/95 p-3 text-xs font-bold text-[#8c1f2c] shadow-lg dark:border-[#7b3e45] dark:bg-[#25151a]/95 dark:text-[#ff9ca7]">
          Selle aja radarikihti ei õnnestunud kuvada. Vali kõrvalkaader või ava ametlik radar.
          {radar.visibleRadarImage && " Ekraanil püsib viimane õnnestunult laaditud kaader."}
        </div>
      )}
    </div>
  );
}
