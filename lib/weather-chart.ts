export type ChartStepDirection = "previous" | "next" | "first" | "last";

export function uniqueSortedTimestamps(values: Iterable<number>): number[] {
  return [...new Set([...values].filter(Number.isFinite))].sort((left, right) => left - right);
}

export function nearestTimestamp(
  timestamps: readonly number[],
  target: number,
  maximumDistance = Number.POSITIVE_INFINITY,
): number | null {
  if (timestamps.length === 0 || !Number.isFinite(target)) return null;

  let low = 0;
  let high = timestamps.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const value = timestamps[middle];
    if (value === target) return value;
    if (value < target) low = middle + 1;
    else high = middle - 1;
  }

  if (low === 0) return Math.abs(timestamps[0] - target) <= maximumDistance ? timestamps[0] : null;
  if (low >= timestamps.length) {
    const value = timestamps[timestamps.length - 1];
    return Math.abs(value - target) <= maximumDistance ? value : null;
  }
  const before = timestamps[low - 1];
  const after = timestamps[low];
  const nearest = target - before <= after - target ? before : after;
  return Math.abs(nearest - target) <= maximumDistance ? nearest : null;
}

export function stepTimestamp(
  timestamps: readonly number[],
  current: number | null,
  direction: ChartStepDirection,
): number | null {
  if (timestamps.length === 0) return null;
  if (direction === "first") return timestamps[0];
  if (direction === "last") return timestamps[timestamps.length - 1];
  if (current === null || !Number.isFinite(current)) {
    return direction === "previous" ? timestamps[timestamps.length - 1] : timestamps[0];
  }

  if (direction === "previous") {
    for (let index = timestamps.length - 1; index >= 0; index -= 1) {
      if (timestamps[index] < current) return timestamps[index];
    }
    return timestamps[0];
  }

  for (const timestamp of timestamps) {
    if (timestamp > current) return timestamp;
  }
  return timestamps[timestamps.length - 1];
}
