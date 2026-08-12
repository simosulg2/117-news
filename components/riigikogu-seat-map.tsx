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
  selectedPartyIds?: ReadonlySet<string>;
  selectedSeatCount?: number;
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
  selectedPartyIds = new Set<string>(),
  selectedSeatCount = 0,
  className = "",
  title = "Riigikogu kohtade projektsioon",
}: RiigikoguSeatMapProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [previewPartyKey, setPreviewPartyKey] = useState<string | null>(null);
  const renderedParties = useMemo(() => assignSeats(parties), [parties]);
  const previewParty = renderedParties.find((party) => party.key === previewPartyKey) ?? null;
  const hasCoalitionSelection = renderedParties.some((party) => selectedPartyIds.has(party.id));
  const coalitionHasMajority = hasCoalitionSelection
    && selectedSeatCount >= RIIGIKOGU_MAJORITY_SEATS;

  const clearPreview = (partyKey: string) => {
    setPreviewPartyKey((current) => current === partyKey ? null : current);
  };
  const coalitionSummary = selectedSeatCount === 51
    ? "täpselt enamus"
    : selectedSeatCount > 51
      ? `enamus +${selectedSeatCount - 51}`
      : `enamusest ${51 - selectedSeatCount} puudu`;

  return (
    <figure className={`border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926] ${className}`}>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
        <span className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">{title}</span>
        <span className="text-[11px] font-semibold tabular-nums text-[#526878] dark:text-[#8da1b0]">
          {RIIGIKOGU_SEAT_COUNT} kohta · enamus {RIIGIKOGU_MAJORITY_SEATS}
        </span>
      </figcaption>

      <div className="m-2 border border-[#c5d2da] bg-[#eaf0f4] px-2 pb-1 pt-2 dark:border-[#243d51] dark:bg-[#071521] sm:m-3 sm:px-4">
        {hasCoalitionSelection && (
          <div aria-hidden="true" className="flex items-center justify-between border-b border-[#c5d2da] px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.08em] dark:border-[#243d51]">
            <span className="text-[#087663] dark:text-[#55d6b2]">← Koalitsioon · {selectedSeatCount}</span>
            <span className="text-[#607583] dark:text-[#7890a2]">Opositsioon · {RIIGIKOGU_SEAT_COUNT - selectedSeatCount} →</span>
          </div>
        )}
        <svg
          viewBox={`0 0 ${RIIGIKOGU_VIEWBOX.width} ${RIIGIKOGU_VIEWBOX.height}`}
          className="block h-auto w-full"
          role="group"
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <title id={titleId}>{title}</title>
          <desc id={descriptionId}>
            101 Riigikogu kohta kuuel poolringikujulisel real. Enamuseks on vaja 51 kohta.
            Erakonna andmete vaatamiseks hõljuta selle kohtade rühma. Koalitsioonilaboris
            valitud erakondade kohad on koondatud vasakule ja tugevamalt esile tõstetud;
            ülejäänud erakonnad on paremal.
            {coalitionHasMajority && " Valitud koalitsioon on saavutanud vähemalt 51 kohta."}
          </desc>

          <g aria-hidden="true">
            <line
              x1={RIIGIKOGU_VIEWBOX.width / 2}
              y1="38"
              x2={RIIGIKOGU_VIEWBOX.width / 2}
              y2="218"
              className={coalitionHasMajority
                ? "stroke-[#087663] transition-colors dark:stroke-[#55d6b2]"
                : "stroke-[#718896] transition-colors dark:stroke-[#58768b]"}
              strokeWidth={coalitionHasMajority ? 2.5 : 1.5}
              strokeDasharray="5 6"
            />
            <rect
              x={RIIGIKOGU_VIEWBOX.width / 2 - 62}
              y="8"
              width="124"
              height="26"
              rx="2"
              className={coalitionHasMajority
                ? "fill-[#d7eee8] stroke-[#087663] transition-colors dark:fill-[#0d302b] dark:stroke-[#55d6b2]"
                : "fill-[#e8eef2] stroke-[#9fb2c0] transition-colors dark:fill-[#102538] dark:stroke-[#35536a]"}
              strokeWidth={coalitionHasMajority ? 2.5 : 1}
            />
            <text
              x={RIIGIKOGU_VIEWBOX.width / 2}
              y="26"
              textAnchor="middle"
              className={coalitionHasMajority
                ? "fill-[#087663] text-[12px] font-black tracking-[0.06em] transition-colors dark:fill-[#55d6b2]"
                : "fill-[#405767] text-[12px] font-bold tracking-[0.06em] transition-colors dark:fill-[#a9b7c2]"}
            >
              {coalitionHasMajority ? `${selectedSeatCount} · ENAMUS ✓` : "51 · ENAMUS"}
            </text>
          </g>

          {renderedParties.map((party) => {
            if (party.positions.length === 0) return null;
            const isPreviewed = party.key === previewPartyKey;
            const isCoalitionParty = !party.unallocated && selectedPartyIds.has(party.id);
            const isEmphasized = isPreviewed || (!previewParty && isCoalitionParty);
            const isDimmed = previewParty
              ? !isPreviewed
              : hasCoalitionSelection && !isCoalitionParty;

            return (
              <g
                key={party.key}
                aria-hidden="true"
                className="cursor-default"
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setPreviewPartyKey(party.key);
                }}
                onPointerLeave={() => clearPreview(party.key)}
                onPointerCancel={() => clearPreview(party.key)}
              >
                {party.positions.map((seat) => (
                  <circle
                    key={seat.index}
                    aria-hidden="true"
                    cx={seat.x}
                    cy={seat.y}
                    r={isEmphasized ? RIIGIKOGU_SEAT_RADIUS + 1 : RIIGIKOGU_SEAT_RADIUS}
                    fill={party.color}
                    className={`transition-[r,opacity,stroke-width] duration-150 ${
                      isCoalitionParty && !previewParty
                        ? "text-[#087663] dark:text-[#55d6b2]"
                        : "text-[#263946] dark:text-[#d8e4eb]"
                    }`}
                    stroke="currentColor"
                    strokeWidth={isEmphasized ? 3 : 1.2}
                    opacity={isDimmed ? 0.24 : 1}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <div
        className="mx-3 mb-3 grid gap-1 border-y border-[#bdcad3] bg-[#edf2f5] px-3 py-2 text-xs dark:border-[#294154] dark:bg-[#0d2030] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      >
        {previewParty ? (
          <>
            <span className="min-w-0 font-bold text-[#243744] dark:text-[#dce7ee]">
              {previewParty.name}
            </span>
            <span className="font-semibold tabular-nums text-[#405767] dark:text-[#a9b7c2]">
              {seatLabel(previewParty.seats)} · {supportLabel(previewParty.support)}
            </span>
          </>
        ) : hasCoalitionSelection ? (
          <>
            <span className="font-bold text-[#087663] dark:text-[#55d6b2]">Valitud koalitsioon</span>
            <span className="font-bold tabular-nums text-[#087663] dark:text-[#55d6b2]">
              {selectedSeatCount}/101 · {coalitionSummary}
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-[#405767] dark:text-[#a9b7c2]">Vali koalitsioonilaborist erakonnad</span>
            <span className="tabular-nums text-[#607583] dark:text-[#8da1b0]">101 kohta · enamus 51</span>
          </>
        )}
      </div>

      <ul
        aria-label="Erakondade kohtade jaotus"
        className="grid border-t border-[#bdcad3] text-[11px] dark:border-[#294154] sm:grid-cols-2 xl:grid-cols-3"
      >
        {renderedParties.map((party) => {
          const isPreviewed = party.key === previewPartyKey;
          const isCoalitionParty = selectedPartyIds.has(party.id);
          return (
            <li key={party.key} className="min-w-0 border-b border-[#d0dbe2] dark:border-[#24394a]">
              <div
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setPreviewPartyKey(party.key);
                }}
                onPointerLeave={() => clearPreview(party.key)}
                onPointerCancel={() => clearPreview(party.key)}
                className={`grid min-h-10 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left ${
                  isPreviewed || isCoalitionParty ? "bg-[#4f8cff]/10" : ""
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
              </div>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
