import type { StudyPlan, WeeklyMetric } from "../../../lib/schedule-types.ts";

export type StudyTotals = {
  maxHours: number;
  actualHours: number;
  remainingHours: number;
  completionPercent: number;
  trackedPlanCount: number;
  totalPlanCount: number;
};

export type WeeklyMetricPercentage = WeeklyMetric & { percentage: number };

export type WeeklyMetricBreakdown = {
  totalHours: number;
  metrics: WeeklyMetricPercentage[];
};

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function deriveStudyTotals(plans: readonly StudyPlan[]): StudyTotals {
  const maxHours = plans.reduce((total, plan) => total + plan.maxHours, 0);
  const actualHours = plans.reduce((total, plan) => total + (plan.actualHours ?? 0), 0);
  return {
    maxHours: round(maxHours, 2),
    actualHours: round(actualHours, 2),
    remainingHours: round(Math.max(0, maxHours - actualHours), 2),
    completionPercent: maxHours === 0 ? 0 : round((actualHours / maxHours) * 100, 1),
    trackedPlanCount: plans.filter((plan) => plan.actualHours !== null).length,
    totalPlanCount: plans.length,
  };
}

export function deriveWeeklyMetricPercentages(
  metrics: readonly WeeklyMetric[],
): WeeklyMetricBreakdown {
  const totalHours = metrics.reduce((total, metric) => total + metric.hours, 0);
  return {
    totalHours: round(totalHours, 2),
    metrics: metrics.map((metric) => ({
      ...metric,
      percentage: totalHours === 0 ? 0 : round((metric.hours / totalHours) * 100, 1),
    })),
  };
}
