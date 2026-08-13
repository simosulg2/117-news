import { MAX_ZOOM } from "../model/radar-map-model";
import { RadarOpenLayersMap } from "./radar-openlayers-map";
import type { ReadyRadarController } from "./use-radar-controller";

export function RadarMap({ radar }: { radar: ReadyRadarController }) {
  return (
    <div
      ref={radar.mapElementRef}
      role="region"
      aria-label="Interaktiivne sademeradar. Liiguta nooleklahvidega ning suurenda pluss- ja miinusklahviga."
      tabIndex={0}
      className="relative h-[20rem] touch-pan-y overflow-hidden bg-[#dfe9ee] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f8cff] dark:bg-[#162735] sm:h-[26rem]"
    >
      <RadarOpenLayersMap
        manifest={radar.manifest}
        frame={radar.selectedFrame}
        center={radar.center}
        zoom={radar.zoom}
        minimumZoom={radar.minimumZoom}
        opacity={radar.opacity}
        onViewChange={(center, zoom) => radar.syncMapView(center, zoom)}
        onFrameVisible={radar.acceptRadarFrame}
        onFrameError={radar.rejectRadarFrame}
      />

      <div className="absolute right-2 top-2 z-20 flex flex-col gap-px shadow-sm">
        <button type="button" aria-label="Suurenda kaarti" onClick={() => radar.zoomBy(1)} disabled={radar.zoom >= MAX_ZOOM} className="h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-xl font-bold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-40 dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]">
          +
        </button>
        <button type="button" aria-label="Vähenda kaarti" onClick={() => radar.zoomBy(-1)} disabled={radar.zoom <= radar.minimumZoom} className="h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-xl font-bold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-40 dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]">
          −
        </button>
        <button type="button" aria-label="Keskenda kaart Võrule" onClick={radar.resetMap} className="mt-1 h-9 w-9 border border-[#758a99] bg-[#f8fafb] text-[10px] font-extrabold text-[#1b2b38] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] dark:border-[#4a6275] dark:bg-[#102332] dark:text-[#edf4f8]">
          VÕRU
        </button>
      </div>

      {radar.layerError && (
        <div role="status" className="absolute inset-x-3 bottom-3 z-20 border border-[#b54e58] bg-[#fff1f1]/95 p-3 text-xs font-bold text-[#8c1f2c] shadow-lg dark:border-[#7b3e45] dark:bg-[#25151a]/95 dark:text-[#ff9ca7]">
          Selle aja radarikihti ei õnnestunud kuvada. Vali kõrvalkaader või ava ametlik radar.
          {radar.activeRadarFrame && " Ekraanil püsib viimane õnnestunult laaditud kaader."}
        </div>
      )}
    </div>
  );
}
