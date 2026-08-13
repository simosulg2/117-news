import type { RadarFrame } from "@/lib/radar";

import { exactTimeFormatter, formatFrameTime } from "./radar-formatters";

type RadarHeaderProps = {
  visibleFrame: RadarFrame;
  selectedFrame: RadarFrame;
  layerLoading: boolean;
  radarIsStale: boolean;
  loadError: string | null;
  notices: readonly string[];
};

export function RadarHeader({
  visibleFrame,
  selectedFrame,
  layerLoading,
  radarIsStale,
  loadError,
  notices,
}: RadarHeaderProps) {
  const frameIsForecast = visibleFrame.kind === "forecast";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#bccbd6] px-3 py-2 dark:border-[#294154]">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`border px-2 py-0.5 text-[10px] font-extrabold tracking-[0.12em] ${frameIsForecast ? "border-[#b87313] bg-[#fff4d6] text-[#87510b] dark:border-[#c88931] dark:bg-[#2b2112] dark:text-[#ffc46b]" : "border-[#268369] bg-[#e4f7f0] text-[#12624f] dark:border-[#36977b] dark:bg-[#0c2822] dark:text-[#67ddb9]"}`}>
            {frameIsForecast ? "LÜHIPROGNOOS" : "MÕÕDETUD"}
          </span>
          <time dateTime={visibleFrame.time} title={exactTimeFormatter.format(new Date(visibleFrame.time))} className="text-sm font-extrabold tabular-nums text-[#101a24] dark:text-[#edf4f8]">
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

      {notices.length > 0 && (
        <div role="status" className="border-b border-[#d29a42] bg-[#fff4d6] px-3 py-2.5 text-xs text-[#70440a] dark:border-[#8d6629] dark:bg-[#2b2112] dark:text-[#ffd18c]">
          <p className="font-extrabold tracking-[0.06em]">RADARITEENUSE TEADE</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 font-semibold">
            {notices.map((notice) => <li key={notice}>{notice}</li>)}
          </ul>
        </div>
      )}
    </>
  );
}
