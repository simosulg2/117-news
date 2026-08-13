import type { ProjectionParty } from "../model/ratings-view-model";
import { coalitionLabel } from "./ratings-formatters";

type CoalitionLabProps = {
  parties: readonly ProjectionParty[];
  selectedPartyIds: ReadonlySet<string>;
  selectedSeatCount: number;
  selectedPartyCount: number;
  onToggleParty: (id: string) => void;
  onClear: () => void;
};

export function CoalitionLab({
  parties,
  selectedPartyIds,
  selectedSeatCount,
  selectedPartyCount,
  onToggleParty,
  onClear,
}: CoalitionLabProps) {
  return (
    <section aria-labelledby="coalition-heading" className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="flex items-center justify-between gap-3 border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
        <h2 id="coalition-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Koalitsioonilabor</h2>
        <div className="flex items-center gap-3">
          {selectedPartyCount > 0 && (
            <button type="button" onClick={onClear} className="text-[11px] font-semibold text-[#526878] underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#8da1b0] dark:hover:text-[#7db0ff]">
              Tühjenda
            </button>
          )}
          <span className={`text-xs font-bold tabular-nums ${selectedSeatCount >= 51 ? "text-[#087663] dark:text-[#55d6b2]" : "text-[#526878] dark:text-[#8da1b0]"}`}>
            {selectedSeatCount}/101
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-[#d0dbe2] p-px dark:bg-[#24394a]">
        {parties.map((party) => {
          const selected = selectedPartyIds.has(party.id);
          return (
            <button key={party.id} type="button" onClick={() => onToggleParty(party.id)} aria-pressed={selected} className={`grid min-h-11 grid-cols-[auto_auto_1fr_auto] items-center gap-2 border-l-2 px-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${selected ? "border-[#087663] bg-[#087663]/10 dark:border-[#55d6b2]" : "border-transparent bg-[#f8fafb] hover:bg-[#edf3f7] dark:bg-[#0d2030] dark:hover:bg-[#102538]"}`}>
              <span aria-hidden="true" className={`grid size-4 place-items-center border text-[10px] font-black ${selected ? "border-[#087663] bg-[#087663] text-white dark:border-[#55d6b2] dark:bg-[#55d6b2] dark:text-[#07131f]" : "border-[#9fb2c0] text-transparent dark:border-[#58768b]"}`}>✓</span>
              <span className="size-2.5 border border-[#263946]/70 dark:border-[#d8e4eb]/80" style={{ backgroundColor: party.color }} aria-hidden="true" />
              <span className="truncate font-semibold text-[#304654] dark:text-[#c2d0d9]">{party.shortName}</span>
              <b className="tabular-nums text-[#192630] dark:text-[#e5eef4]">{party.seats}</b>
            </button>
          );
        })}
      </div>
      <div aria-live="polite" className={`border-t px-3 py-2 text-xs font-semibold ${selectedSeatCount >= 51 ? "border-[#58a895] bg-[#087663]/5 text-[#087663] dark:border-[#2b7b69] dark:text-[#55d6b2]" : "border-[#bdcad3] text-[#526878] dark:border-[#294154] dark:text-[#8da1b0]"}`}>
        {selectedPartyCount === 0 ? "Vali erakonnad, et proovida enamust." : `${selectedSeatCount} kohta · ${coalitionLabel(selectedSeatCount)}`}
      </div>
    </section>
  );
}
