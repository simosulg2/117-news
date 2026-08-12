export const RIIGIKOGU_SEAT_COUNT = 101;
export const RIIGIKOGU_MAJORITY_SEATS = 51;
export const RIIGIKOGU_SEAT_RADIUS = 7;

export const RIIGIKOGU_VIEWBOX = {
  width: 720,
  height: 360,
} as const;

export const RIIGIKOGU_ROW_SEAT_COUNTS = [9, 12, 15, 18, 22, 25] as const;

export type RiigikoguSeatPosition = {
  /** Political ordering from the left edge of the chamber to the right. */
  index: number;
  /** Zero-based row, from the innermost row to the outermost row. */
  row: number;
  /** Zero-based position within the row, from left to right. */
  seatInRow: number;
  /** Normalized left-to-right position on the row's arc. */
  progress: number;
  x: number;
  y: number;
};

const CHAMBER_CENTER_X = RIIGIKOGU_VIEWBOX.width / 2;
const CHAMBER_CENTER_Y = 322;
const INNER_RADIUS = 92;
const ROW_GAP = 34;

/**
 * Builds six concentric half-circle rows, then returns their seats in
 * left-to-right political order. Keeping this geometry pure makes it usable
 * by both the SVG renderer and low-cost Node tests.
 */
export function createRiigikoguSeatLayout(): RiigikoguSeatPosition[] {
  const seats = RIIGIKOGU_ROW_SEAT_COUNTS.flatMap((seatCount, row) => {
    const radius = INNER_RADIUS + row * ROW_GAP;

    return Array.from({ length: seatCount }, (_, seatInRow) => {
      const progress = seatInRow / (seatCount - 1);
      const angle = Math.PI + progress * Math.PI;

      return {
        index: -1,
        row,
        seatInRow,
        progress,
        x: CHAMBER_CENTER_X + radius * Math.cos(angle),
        y: CHAMBER_CENTER_Y + radius * Math.sin(angle),
      } satisfies RiigikoguSeatPosition;
    });
  });

  return seats
    .sort((left, right) => left.progress - right.progress || right.row - left.row)
    .map((seat, index) => ({ ...seat, index }));
}
