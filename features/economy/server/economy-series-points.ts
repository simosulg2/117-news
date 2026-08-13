import type { EconomyFrequency, EconomyPeriod } from "@/lib/economy-types";
import type { RawEconomyPoint } from "@/features/economy/model/economy-indicators";

import { ParsedPxDataset } from "./pxweb-dataset";

function cellPoint(
  dataset: ParsedPxDataset,
  coordinates: Record<string, string>,
  period: EconomyPeriod,
  scale: number,
): RawEconomyPoint | null {
  const cell = dataset.cell(coordinates);
  if (cell.value === null) return null;
  return { period, value: cell.value / scale, sourceStatus: cell.status };
}

function monthPeriod(year: string, month: string): EconomyPeriod {
  const paddedMonth = month.padStart(2, "0");
  return { id: `${year}M${paddedMonth}`, label: `${paddedMonth}.${year}`, frequency: "monthly" };
}

export function splitMonthPoints(
  dataset: ParsedPxDataset,
  coordinates: Record<string, string>,
  scale = 1,
): RawEconomyPoint[] {
  const points: RawEconomyPoint[] = [];
  for (const year of dataset.codes("Aasta")) {
    for (const month of dataset.codes("Kuu")) {
      const point = cellPoint(dataset, { ...coordinates, Aasta: year, Kuu: month }, monthPeriod(year, month), scale);
      if (point) points.push(point);
    }
  }
  return points;
}

export function codedPeriodPoints(
  dataset: ParsedPxDataset,
  periodDimension: string,
  frequency: EconomyFrequency,
  coordinates: Record<string, string>,
  scale = 1,
): RawEconomyPoint[] {
  const points: RawEconomyPoint[] = [];
  for (const code of dataset.codes(periodDimension)) {
    const normalizedCode = frequency === "monthly"
      ? code.replace(/^(\d{4})M(\d)$/, "$1M0$2")
      : code;
    const label = frequency === "monthly"
      ? `${normalizedCode.slice(5)}.${normalizedCode.slice(0, 4)}`
      : dataset.categoryLabel(periodDimension, code).replace(" kvartal", " kv");
    const point = cellPoint(
      dataset,
      { ...coordinates, [periodDimension]: code },
      { id: normalizedCode, label, frequency },
      scale,
    );
    if (point) points.push(point);
  }
  return points;
}

export function splitQuarterPoints(
  dataset: ParsedPxDataset,
  coordinates: Record<string, string>,
  scale = 1,
): RawEconomyPoint[] {
  const romanToQuarter: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4" };
  const points: RawEconomyPoint[] = [];
  for (const year of dataset.codes("Aasta")) {
    for (const quarter of dataset.codes("Kvartal")) {
      const number = romanToQuarter[quarter];
      if (!number) continue;
      const point = cellPoint(
        dataset,
        { ...coordinates, Aasta: year, Kvartal: quarter },
        { id: `${year}Q${number}`, label: `${year} ${quarter} kv`, frequency: "quarterly" },
        scale,
      );
      if (point) points.push(point);
    }
  }
  return points;
}
