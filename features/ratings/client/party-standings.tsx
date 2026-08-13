import type { RatingsParty, RatingsWave } from "@/lib/ratings-types";
import { WatchToggle } from "@/features/watchlist/client/watch-toggle";

import {
  isGovernmentParty,
  type ProjectionParty,
} from "../model/ratings-view-model";
import { dateFormatter, percentage, signedChange } from "./ratings-formatters";

type PartyStandingsProps = {
  previousWave: RatingsWave | null;
  primaryParties: readonly RatingsParty[];
  minorParties: readonly RatingsParty[];
  projectedParties: readonly ProjectionParty[];
  showMinorParties: boolean;
  onToggleMinorParties: () => void;
};

type PartyRowProps = {
  party: RatingsParty;
  projectedSeats: number;
};

function PartyRow({ party, projectedSeats }: PartyRowProps) {
  const passes = (party.supportPct ?? 0) >= 5;
  const currentRole = isGovernmentParty(party.id) ? "Valitsus · " : "";
  const status = `${currentRole}${passes ? "saaks kohti" : "alla 5%"}`;

  return (
    <tr className="border-t border-[#d0dbe2] text-[#304654] dark:border-[#24394a] dark:text-[#c2d0d9]">
      <th scope="row" className="px-3 py-2 text-left font-semibold">
        <span className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 border border-[#07131f]/50 dark:border-white/70" style={{ backgroundColor: party.color }} aria-hidden="true" />
          <span>{party.name}</span>
        </span>
      </th>
      <td className="px-3 py-2 text-right font-bold tabular-nums text-[#192630] dark:text-[#e5eef4]">{percentage(party.supportPct)}</td>
      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${party.changePctPoints !== null && party.changePctPoints > 0 ? "text-[#087663] dark:text-[#55d6b2]" : party.changePctPoints !== null && party.changePctPoints < 0 ? "text-[#9d2733] dark:text-[#ff929d]" : "text-[#607583] dark:text-[#8da1b0]"}`}>
        {signedChange(party.changePctPoints)}
      </td>
      <td className="px-3 py-2 text-right text-lg font-bold tabular-nums text-[#245fae] dark:text-[#7db0ff]">{projectedSeats}</td>
      <td className="px-3 py-2">
        <span className={`inline-flex border-l-2 pl-2 font-semibold ${passes ? "border-[#245fae] text-[#405767] dark:border-signal dark:text-[#a9b7c2]" : "border-[#9d762f] text-[#805818] dark:border-[#efb860] dark:text-[#efb860]"}`}>{status}</span>
      </td>
      <td className="px-3 py-2 text-right">
        <span className="inline-flex gap-1">
          <WatchToggle kind="party-rating" targetId={party.id} label={party.name} idleLabel="Reiting" watchedLabel="Reiting ✓" compact />
          <WatchToggle kind="party-threshold" targetId={party.id} label={`${party.name}: 5% künnise ületus`} idleLabel="5% piir" watchedLabel="5% ✓" compact />
        </span>
      </td>
    </tr>
  );
}

export function PartyStandings({
  previousWave,
  primaryParties,
  minorParties,
  projectedParties,
  showMinorParties,
  onToggleMinorParties,
}: PartyStandingsProps) {
  const projectedSeats = new Map(projectedParties.map((party) => [party.id, party.seats]));

  return (
    <section aria-labelledby="party-table-heading" className="mt-3 overflow-hidden border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="grid gap-2 border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <h2 id="party-table-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Erakondade seis</h2>
          <p className="mt-0.5 text-[11px] text-[#526878] dark:text-[#8da1b0]">
            Põhivaates on künnise ületajad ja valitsuserakonnad. Muutus eelmise nädala 4 nädala koondiga
            {previousWave ? ` (${dateFormatter.format(new Date(`${previousWave.startDate}T12:00:00Z`))}–${dateFormatter.format(new Date(`${previousWave.endDate}T12:00:00Z`))})` : ""} · pp
          </p>
        </div>
        {minorParties.length > 0 && (
          <button
            type="button"
            aria-expanded={showMinorParties}
            aria-controls="minor-party-rows"
            onClick={onToggleMinorParties}
            className="min-h-9 border border-[#718896] bg-[#edf2f5] px-3 text-xs font-bold text-[#405767] outline-none hover:border-[#245fae] hover:text-[#245fae] focus-visible:ring-2 focus-visible:ring-signal dark:border-[#58768b] dark:bg-[#102538] dark:text-[#a9b7c2] dark:hover:text-[#7db0ff]"
          >
            {showMinorParties ? "Peida" : "Näita"} väiksemaid ({minorParties.length})
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-xs">
          <thead className="bg-[#edf2f5] text-left text-[10px] font-bold uppercase tracking-[0.07em] text-[#607583] dark:bg-[#0d2030] dark:text-[#7890a2]">
            <tr>
              <th scope="col" className="px-3 py-2">Erakond</th>
              <th scope="col" className="px-3 py-2 text-right">Toetus</th>
              <th scope="col" className="px-3 py-2 text-right">Muutus</th>
              <th scope="col" className="px-3 py-2 text-right">Kohad</th>
              <th scope="col" className="px-3 py-2">Staatus</th>
              <th scope="col" className="px-3 py-2 text-right">Jälgimine</th>
            </tr>
          </thead>
          <tbody>
            {primaryParties.map((party) => (
              <PartyRow key={party.id} party={party} projectedSeats={projectedSeats.get(party.id) ?? 0} />
            ))}
          </tbody>
          <tbody id="minor-party-rows" hidden={!showMinorParties}>
            {minorParties.map((party) => (
              <PartyRow key={party.id} party={party} projectedSeats={projectedSeats.get(party.id) ?? 0} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
