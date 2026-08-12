"use client";

import { useId, useMemo, useState } from "react";

import {
  createRiigikoguSeatLayout,
  RIIGIKOGU_MAJORITY_SEATS,
  RIIGIKOGU_SEAT_COUNT,
  RIIGIKOGU_SEAT_RADIUS,
  RIIGIKOGU_VIEWBOX,
  type RiigikoguSeatPosition,
} from "@/lib/riigikogu-layout";

export type RiigikoguProjectedParty = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  seats: number;
  support: number;
};

export type RiigikoguSeatMapProps = {
  parties: readonly RiigikoguProjectedParty[];
  className?: string;
  title?: string;
};

type RenderedParty = {
  key: string;
  id: string;
  name: string;
  shortName: string;
  color: string;
  seats: number;
  support: number | null;
  positions: RiigikoguSeatPosition[];
  unallocated: boolean;
};

const SEAT_LAYOUT = createRiigikoguSeatLayout();
const supportFormatter = new Intl.NumberFormat("et-EE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function boundedInteger(value: number, maximum: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.trunc(value)));
}

function boundedSupport(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function seatLabel(seats: number): string {
  return seats === 1 ? "1 koht" : `${seats} kohta`;
}

function supportLabel(support: number | null): string {
  return support === null ? "toetus teadmata" : `${supportFormatter.format(support)}% toetust`;
}

function assignSeats(parties: readonly RiigikoguProjectedParty[]): RenderedParty[] {
  let cursor = 0;
  const rendered: RenderedParty[] = parties.map((party, index) => {
    const seats = boundedInteger(party.seats, RIIGIKOGU_SEAT_COUNT - cursor);
    const positions = SEAT_LAYOUT.slice(cursor, cursor + seats);
    cursor += seats;

    return {
      key: `${party.id || "party"}-${index}`,
      id: party.id,
      name: party.name.trim() || party.shortName.trim() || "Nimetu erakond",
      shortName: party.shortName.trim() || party.name.trim() || "—",
      color: party.color.trim() || "#7890a2",
      seats,
      support: boundedSupport(party.support),
      positions,
      unallocated: false,
    } satisfies RenderedParty;
  });

  if (cursor < RIIGIKOGU_SEAT_COUNT) {
    rendered.push({
      key: "__unallocated__",
      id: "unallocated",
      name: "Jaotamata kohad",
      shortName: "Jaotamata",
      color: "#7890a2",
      seats: RIIGIKOGU_SEAT_COUNT - cursor,
      support: null,
      positions: SEAT_LAYOUT.slice(cursor),
      unallocated: true,
    });
  }

  return rendered;
}

export function RiigikoguSeatMap({
  parties,
  className = "",
  title = "Riigikogu kohtade projektsioon",
}: RiigikoguSeatMapProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [previewPartyKey, setPreviewPartyKey] = useState<string | null>(null);
  const [pinnedPartyKey, setPinnedPartyKey] = useState<string | null>(null);
  const renderedParties = useMemo(() => assignSeats(parties), [parties]);
  const activePartyKey = previewPartyKey ?? pinnedPartyKey;
  const activeParty = renderedParties.find((party) => party.key === activePartyKey) ?? null;
  const detailParty = activeParty ?? renderedParties.find((party) => !party.unallocated) ?? renderedParties[0] ?? null;
  const tooltipAnchor = activeParty
    ? activeParty.positions[Math.floor(activeParty.positions.length / 2)]
      ?? { x: RIIGIKOGU_VIEWBOX.width / 2, y: 322 }
    : null;

  const setPreview = (partyKey: string) => setPreviewPartyKey(partyKey);
  const clearPreview = (partyKey: string) => {
    setPreviewPartyKey((current) => current === partyKey ? null : current);
  };
  const togglePinned = (partyKey: string) => {
    setPinnedPartyKey((current) => current === partyKey ? null : partyKey);
  };
  const clearSelection = () => {
    setPreviewPartyKey(null);
    setPinnedPartyKey(null);
  };

  const tooltipX = tooltipAnchor ? Math.min(606, Math.max(114, tooltipAnchor.x)) : 0;
  const tooltipY = tooltipAnchor ? Math.min(304, Math.max(54, tooltipAnchor.y - 20)) : 0;

  return (
    <figure className={`border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926] ${className}`}>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
        <span className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">{title}</span>
        <span className="text-[11px] font-semibold tabular-nums text-[#526878] dark:text-[#8da1b0]">
          {RIIGIKOGU_SEAT_COUNT} kohta · enamus {RIIGIKOGU_MAJORITY_SEATS}
        </span>
      </figcaption>

      <div className="px-2 pb-1 pt-2 sm:px-4">
        <svg
          viewBox={`0 0 ${RIIGIKOGU_VIEWBOX.width} ${RIIGIKOGU_VIEWBOX.height}`}
          className="block h-auto w-full"
          role="group"
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <title id={titleId}>{title}</title>
          <desc id={descriptionId}>
            101 Riigikogu kohta kuuel poolringikujulisel real. Enamuseks on vaja 51 kohta.
            Erakonna andmete vaatamiseks hõljuta, puuduta või fookusta selle kohtade rühm.
          </desc>

          <g aria-hidden="true">
            <line
              x1={RIIGIKOGU_VIEWBOX.width / 2}
              y1="38"
              x2={RIIGIKOGU_VIEWBOX.width / 2}
              y2="218"
              className="stroke-[#718896] dark:stroke-[#58768b]"
              strokeWidth="1.5"
              strokeDasharray="5 6"
            />
            <rect
              x={RIIGIKOGU_VIEWBOX.width / 2 - 62}
              y="8"
              width="124"
              height="26"
              rx="2"
              className="fill-[#e8eef2] stroke-[#9fb2c0] dark:fill-[#102538] dark:stroke-[#35536a]"
            />
            <text
              x={RIIGIKOGU_VIEWBOX.width / 2}
              y="26"
              textAnchor="middle"
              className="fill-[#405767] text-[12px] font-bold tracking-[0.06em] dark:fill-[#a9b7c2]"
            >
              51 · ENAMUS
            </text>
          </g>

          {renderedParties.map((party) => {
            if (party.positions.length === 0) return null;
            const isActive = party.key === activePartyKey;

            return (
              <g
                key={party.key}
                aria-hidden="true"
                className="cursor-pointer"
                onPointerEnter={() => setPreview(party.key)}
                onPointerLeave={() => clearPreview(party.key)}
                onClick={() => togglePinned(party.key)}
              >
                {party.positions.map((seat) => (
                  <circle
                    key={seat.index}
                    aria-hidden="true"
                    cx={seat.x}
                    cy={seat.y}
                    r={isActive ? RIIGIKOGU_SEAT_RADIUS + 1.15 : RIIGIKOGU_SEAT_RADIUS}
                    fill={party.color}
                    className={`transition-[r,opacity,stroke-width] duration-150 ${
                      isActive
                        ? "text-[#07131f] dark:text-[#f3f8fb]"
                        : "text-white dark:text-[#07131f]"
                    }`}
                    stroke="currentColor"
                    strokeWidth={isActive ? 2.5 : 1.35}
                    opacity={activePartyKey && !isActive ? 0.58 : 1}
                  />
                ))}
              </g>
            );
          })}

          {activeParty && tooltipAnchor && (
            <g aria-hidden="true" pointerEvents="none">
              <rect
                x={tooltipX - 106}
                y={tooltipY - 40}
                width="212"
                height="42"
                rx="2"
                className="fill-[#f8fafb] stroke-[#29485f] dark:fill-[#08131f] dark:stroke-[#7db0ff]"
                strokeWidth="1.5"
              />
              <text
                x={tooltipX}
                y={tooltipY - 23}
                textAnchor="middle"
                className="fill-[#101a24] text-[12px] font-bold dark:fill-[#edf4f8]"
              >
                {activeParty.shortName.slice(0, 24)} · {seatLabel(activeParty.seats)}
              </text>
              <text
                x={tooltipX}
                y={tooltipY - 9}
                textAnchor="middle"
                className="fill-[#526878] text-[10px] font-semibold dark:fill-[#a9b7c2]"
              >
                {supportLabel(activeParty.support)}
              </text>
            </g>
          )}
        </svg>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mx-3 mb-3 grid gap-1 border-y border-[#bdcad3] bg-[#edf2f5] px-3 py-2 text-xs dark:border-[#294154] dark:bg-[#0d2030] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        {detailParty ? (
          <>
            <span className="min-w-0 font-bold text-[#243744] dark:text-[#dce7ee]">
              {detailParty.name}
              {!activeParty && (
                <span className="ml-2 font-normal text-[#607583] dark:text-[#8da1b0]">
                  · vali kaardilt erakond
                </span>
              )}
            </span>
            <span className="font-semibold tabular-nums text-[#405767] dark:text-[#a9b7c2]">
              {seatLabel(detailParty.seats)} · {supportLabel(detailParty.support)}
            </span>
          </>
        ) : (
          <span className="text-[#607583] dark:text-[#8da1b0]">Kohtade projektsioon puudub.</span>
        )}
      </div>

      <ul
        aria-label="Erakondade kohtade jaotus"
        className="grid border-t border-[#bdcad3] text-[11px] dark:border-[#294154] sm:grid-cols-2 xl:grid-cols-3"
      >
        {renderedParties.map((party) => {
          const isActive = party.key === activePartyKey;
          return (
            <li key={party.key} className="min-w-0 border-b border-[#d0dbe2] dark:border-[#24394a]">
              <button
                type="button"
                aria-pressed={pinnedPartyKey === party.key}
                onPointerEnter={() => setPreview(party.key)}
                onPointerLeave={() => clearPreview(party.key)}
                onFocus={() => setPreview(party.key)}
                onBlur={() => clearPreview(party.key)}
                onClick={() => togglePinned(party.key)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  clearSelection();
                  event.currentTarget.blur();
                }}
                className={`grid min-h-10 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${
                  isActive ? "bg-[#4f8cff]/10" : "hover:bg-[#4f8cff]/[0.06]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 border border-[#07131f]/60 dark:border-white/70"
                  style={{ backgroundColor: party.color }}
                />
                <span className="min-w-0 truncate font-bold text-[#304654] dark:text-[#c2d0d9]" title={party.name}>
                  {party.shortName}
                </span>
                <span className="whitespace-nowrap tabular-nums text-[#526878] dark:text-[#8da1b0]">
                  <b className="text-[#192630] dark:text-[#e5eef4]">{party.seats}</b> · {party.support === null ? "—" : `${supportFormatter.format(party.support)}%`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
