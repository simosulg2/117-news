import type { WeatherWarning } from "./weather-warning-types.ts";

export type WeatherWarningPhase = "active" | "upcoming" | "expired";

function parsedTime(value: string | null): number | null {
  if (!value) return null;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : null;
}

export function weatherWarningPhase(warning: WeatherWarning, nowMs: number): WeatherWarningPhase {
  const validFrom = parsedTime(warning.validFrom);
  const validTo = parsedTime(warning.validTo);
  if (validTo !== null && validTo <= nowMs) return "expired";
  if (validFrom !== null && validFrom > nowMs) return "upcoming";
  return "active";
}

export function visibleWeatherWarnings(warnings: readonly WeatherWarning[], nowMs: number): WeatherWarning[] {
  const phaseRank: Record<Exclude<WeatherWarningPhase, "expired">, number> = { active: 0, upcoming: 1 };
  return warnings
    .filter((warning) => weatherWarningPhase(warning, nowMs) !== "expired")
    .sort((left, right) => {
      const leftPhase = weatherWarningPhase(left, nowMs) as Exclude<WeatherWarningPhase, "expired">;
      const rightPhase = weatherWarningPhase(right, nowMs) as Exclude<WeatherWarningPhase, "expired">;
      const phaseDifference = phaseRank[leftPhase] - phaseRank[rightPhase];
      if (phaseDifference !== 0) return phaseDifference;
      if (leftPhase === "upcoming") {
        const timeDifference = (parsedTime(left.validFrom) ?? Number.MAX_SAFE_INTEGER)
          - (parsedTime(right.validFrom) ?? Number.MAX_SAFE_INTEGER);
        if (timeDifference !== 0) return timeDifference;
      }
      return (right.level ?? 0) - (left.level ?? 0) || left.id.localeCompare(right.id);
    });
}
