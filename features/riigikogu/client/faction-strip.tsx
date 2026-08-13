import { partyIdentity } from "@/lib/party-registry";
import type { RiigikoguFactionSummary } from "@/lib/riigikogu-types";

export function FactionStrip({ factions }: { factions: RiigikoguFactionSummary[] }) {
  if (!factions.length) return null;
  return <div aria-label="XV Riigikogu praegune fraktsiooniline koosseis" className="flex gap-px overflow-x-auto border-b border-[#d5dfe6] bg-[#d5dfe6] dark:border-[#263d50] dark:bg-[#263d50]">
    {factions.map((faction) => {
      const party = faction.partyId ? partyIdentity(faction.partyId) : null;
      return <div key={faction.id} className="flex min-w-max items-center gap-2 bg-[#f5f8fa] px-3 py-2 text-[10px] dark:bg-[#0a1723]">
        <span aria-hidden="true" className="size-2" style={{ backgroundColor: party?.color ?? "#8295a4" }} />
        <span className="font-semibold">{party?.shortName ?? "Fraktsioonita"}</span>
        <b className="font-mono text-xs">{faction.memberCount}</b>
      </div>;
    })}
  </div>;
}
