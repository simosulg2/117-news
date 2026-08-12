import assert from "node:assert/strict";
import test from "node:test";

import {
  createRiigikoguSeatLayout,
  RIIGIKOGU_ROW_SEAT_COUNTS,
  RIIGIKOGU_SEAT_COUNT,
  RIIGIKOGU_SEAT_RADIUS,
  RIIGIKOGU_VIEWBOX,
} from "../lib/riigikogu-layout.ts";

test("creates exactly 101 uniquely positioned Riigikogu seats", () => {
  const seats = createRiigikoguSeatLayout();
  const coordinateKeys = seats.map((seat) => `${seat.x.toFixed(8)}:${seat.y.toFixed(8)}`);

  assert.equal(seats.length, RIIGIKOGU_SEAT_COUNT);
  assert.equal(new Set(coordinateKeys).size, RIIGIKOGU_SEAT_COUNT);
  assert.deepEqual(seats.map((seat) => seat.index), Array.from({ length: 101 }, (_, index) => index));
});

test("keeps every complete seat circle inside the SVG view box", () => {
  for (const seat of createRiigikoguSeatLayout()) {
    assert.ok(seat.x - RIIGIKOGU_SEAT_RADIUS >= 0, `seat ${seat.index} crosses the left edge`);
    assert.ok(
      seat.x + RIIGIKOGU_SEAT_RADIUS <= RIIGIKOGU_VIEWBOX.width,
      `seat ${seat.index} crosses the right edge`,
    );
    assert.ok(seat.y - RIIGIKOGU_SEAT_RADIUS >= 0, `seat ${seat.index} crosses the top edge`);
    assert.ok(
      seat.y + RIIGIKOGU_SEAT_RADIUS <= RIIGIKOGU_VIEWBOX.height,
      `seat ${seat.index} crosses the bottom edge`,
    );
  }
});

test("uses the intended concentric row sizes and left-to-right political order", () => {
  const seats = createRiigikoguSeatLayout();
  const counts = RIIGIKOGU_ROW_SEAT_COUNTS.map(
    (_, row) => seats.filter((seat) => seat.row === row).length,
  );

  assert.deepEqual(counts, [...RIIGIKOGU_ROW_SEAT_COUNTS]);
  assert.ok(seats.every((seat, index) => index === 0 || seats[index - 1].progress <= seat.progress));

  for (const row of RIIGIKOGU_ROW_SEAT_COUNTS.keys()) {
    const rowSeats = seats
      .filter((seat) => seat.row === row)
      .sort((left, right) => left.seatInRow - right.seatInRow);
    assert.ok(rowSeats.every((seat, index) => index === 0 || rowSeats[index - 1].x < seat.x));
  }
});
