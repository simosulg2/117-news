export type UtcMonthRange = {
  year: number;
  month: number;
  firstDay: number;
  lastDay: number;
};

export function utcMonthRanges(start: Date, end: Date): UtcMonthRange[] {
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (!Number.isFinite(startDay) || !Number.isFinite(endDay) || startDay > endDay) return [];

  const ranges: UtcMonthRange[] = [];
  let year = start.getUTCFullYear();
  let monthIndex = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonthIndex = end.getUTCMonth();

  while (year < endYear || (year === endYear && monthIndex <= endMonthIndex)) {
    const isFirst = year === start.getUTCFullYear() && monthIndex === start.getUTCMonth();
    const isLast = year === endYear && monthIndex === endMonthIndex;
    ranges.push({
      year,
      month: monthIndex + 1,
      firstDay: isFirst ? start.getUTCDate() : 1,
      lastDay: isLast ? end.getUTCDate() : new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate(),
    });
    monthIndex += 1;
    if (monthIndex === 12) {
      monthIndex = 0;
      year += 1;
    }
  }
  return ranges;
}
