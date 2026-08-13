import type { RadarManifest } from "../model/radar-types";

export function RadarFooter({ source }: { source: RadarManifest["source"] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[#bccbd6] px-3 py-2 text-[10px] font-semibold text-[#526878] dark:border-[#294154] dark:text-[#8da1b0]">
      <span>
        {source.attribution} · {source.license} · Aluskaart:{" "}
        <a href="https://geoportaal.maaamet.ee/" target="_blank" rel="noopener noreferrer external" className="underline decoration-dotted underline-offset-2 hover:text-[#245fae] dark:hover:text-[#7db0ff]">
          Maa- ja Ruumiamet
        </a>
      </span>
      <a href={source.pageUrl} target="_blank" rel="noopener noreferrer external" className="font-bold text-[#245fae] underline decoration-dotted underline-offset-2 hover:text-[#174b88] dark:text-[#7db0ff] dark:hover:text-[#a8caff]">
        Ava ametlik radar ↗
      </a>
    </div>
  );
}
