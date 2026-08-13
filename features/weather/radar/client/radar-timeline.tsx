import { exactTimeFormatter, formatFrameTime, precipitationLegend } from "./radar-formatters";
import type { ReadyRadarController } from "./use-radar-controller";

export function RadarTimelineControls({ radar }: { radar: ReadyRadarController }) {
  const forecastStartIndex = radar.manifest.frames.findIndex((frame) => frame.kind === "forecast");

  return (
    <div className="border-t border-[#bccbd6] px-3 py-3 dark:border-[#294154]">
      <div className="grid grid-cols-[auto_auto_auto_minmax(0,1fr)] items-center gap-2">
        <button
          type="button"
          aria-label="Eelmine radarikaader"
          onClick={radar.previousFrame}
          disabled={radar.frameIndex === 0}
          className="h-9 min-w-9 border border-[#90a4b2] px-2 text-sm font-extrabold text-[#245fae] hover:border-[#4f8cff] hover:bg-[#4f8cff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-35 dark:border-[#3b5870] dark:text-[#7db0ff]"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label={radar.playing ? "Peata radarianimatsioon" : "Käivita radarianimatsioon"}
          aria-pressed={radar.playing}
          onClick={radar.togglePlaying}
          className="h-9 min-w-[5.25rem] border border-[#4f8cff] bg-[#4f8cff]/10 px-3 text-xs font-extrabold text-[#245fae] hover:bg-[#4f8cff]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] dark:text-[#7db0ff]"
        >
          {radar.playing ? "Ⅱ PEATA" : "▶ MÄNGI"}
        </button>
        <button
          type="button"
          aria-label="Järgmine radarikaader"
          onClick={radar.nextFrame}
          disabled={radar.frameIndex === radar.manifest.frames.length - 1}
          className="h-9 min-w-9 border border-[#90a4b2] px-2 text-sm font-extrabold text-[#245fae] hover:border-[#4f8cff] hover:bg-[#4f8cff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] disabled:opacity-35 dark:border-[#3b5870] dark:text-[#7db0ff]"
        >
          ›
        </button>
        <label className="min-w-0">
          <span className="sr-only">Radarikaadri aeg</span>
          <input
            type="range"
            min={0}
            max={radar.manifest.frames.length - 1}
            value={radar.frameIndex}
            aria-valuetext={`${radar.selectedFrame.kind === "forecast" ? "Lühiprognoos" : "Mõõdetud"}, ${exactTimeFormatter.format(new Date(radar.selectedFrame.time))}`}
            onChange={(event) => radar.selectFrame(Number(event.currentTarget.value))}
            className="h-9 w-full cursor-pointer accent-[#4f8cff]"
          />
        </label>
      </div>

      <div className="mt-1 flex justify-between text-[10px] font-bold tabular-nums text-[#526878] dark:text-[#8da1b0]">
        <span>{formatFrameTime(radar.manifest.frames[0].time)}</span>
        {forecastStartIndex >= 0 && (
          <span className="text-[#87510b] dark:text-[#ffc46b]">PROGNOOS ALATES {formatFrameTime(radar.manifest.frames[forecastStartIndex].time)}</span>
        )}
        <span>{formatFrameTime(radar.manifest.frames.at(-1)?.time ?? radar.selectedFrame.time)}</span>
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
            value={radar.opacity}
            aria-valuetext={`${radar.opacity} protsenti`}
            onChange={(event) => radar.setOpacity(Number(event.currentTarget.value))}
            className="w-24 accent-[#4f8cff]"
          />
          <span className="w-8 text-right tabular-nums">{radar.opacity}%</span>
        </label>
      </div>
    </div>
  );
}
