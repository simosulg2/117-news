"use client";

import { RadarPanel } from "@/features/weather/radar/client/radar-panel";
import { RadarLoading, RadarUnavailable } from "@/features/weather/radar/client/radar-states";
import {
  isReadyRadarController,
  useRadarController,
} from "@/features/weather/radar/client/use-radar-controller";

export function WeatherRadar({ className = "" }: { className?: string }) {
  const radar = useRadarController();

  if (radar.loading) return <RadarLoading className={className} />;
  if (!isReadyRadarController(radar)) {
    return (
      <RadarUnavailable
        className={className}
        error={radar.loadError}
        onRetry={radar.retry}
      />
    );
  }
  return <RadarPanel radar={radar} className={className} />;
}
