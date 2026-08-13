import type { RiigikoguVoteDetail, RiigikoguVoteSummary } from "@/lib/riigikogu-types";
import { safeDate } from "./riigikogu-formatters";
import { VoteDetailPanel } from "./vote-detail";

type Props = {
  votes: RiigikoguVoteSummary[];
  selectedId: string | null;
  detail: RiigikoguVoteDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onSelect: (id: string | null) => void;
};

export function VotesView({ votes, selectedId, detail, detailLoading, detailError, onSelect }: Props) {
  if (!votes.length) return <p className="border border-[#b7c5cf] bg-white p-5 text-sm dark:border-[#263d50] dark:bg-[#0b1926]">Hiljutisi sisulisi hääletusi ei õnnestunud laadida.</p>;
  return <div className="space-y-3">{votes.map((vote) => {
    const open = vote.id === selectedId;
    return <article key={vote.id} className="border border-[#b7c5cf] bg-white dark:border-[#263d50] dark:bg-[#0b1926]">
      <button type="button" aria-expanded={open} onClick={() => onSelect(open ? null : vote.id)} className="grid w-full gap-3 p-4 text-left outline-none hover:bg-[#f4f7f9] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal sm:grid-cols-[8rem_1fr_auto] dark:hover:bg-[#102538]">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#657b8c]">{safeDate(vote.startedAt, true)}</p><p className="mt-1 font-mono text-xs">#{vote.number}</p></div>
        <div><h2 className="text-sm font-bold leading-5">{vote.draft?.title ?? vote.description}</h2><p className="mt-1 text-xs text-[#657b8c]">{vote.description} · {vote.type}</p></div>
        <div className="flex items-center gap-3 text-xs tabular-nums"><b className="text-[#087a5b] dark:text-[#55d6b2]">{vote.totals.inFavor} poolt</b><b className="text-[#b42318] dark:text-[#ff9b92]">{vote.totals.against} vastu</b><span aria-hidden="true">{open ? "−" : "+"}</span></div>
      </button>
      {open && <VoteDetailPanel data={detail} loading={detailLoading} error={detailError} />}
    </article>;
  })}</div>;
}
