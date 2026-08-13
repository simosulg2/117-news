import { RadarFooter } from "./radar-footer";
import { RadarHeader } from "./radar-header";
import { RadarMap } from "./radar-map";
import { RadarTimelineControls } from "./radar-timeline";
import type { ReadyRadarController } from "./use-radar-controller";

export function RadarPanel({
  radar,
  className,
}: {
  radar: ReadyRadarController;
  className: string;
}) {
  return (
    <div className={`border border-[#bccbd6] bg-[#f6f8f9] dark:border-[#294154] dark:bg-[#091722] ${className}`}>
      <RadarHeader
        visibleFrame={radar.visibleFrame}
        selectedFrame={radar.selectedFrame}
        layerLoading={radar.layerLoading}
        radarIsStale={radar.radarIsStale}
        loadError={radar.loadError}
        notices={radar.manifest.notices}
      />
      <RadarMap radar={radar} />
      <RadarTimelineControls radar={radar} />
      <RadarFooter source={radar.manifest.source} />
    </div>
  );
}
