import type {
  RiigikoguDraftReference,
  RiigikoguVoteChoice,
  RiigikoguVoteSummary,
  RiigikoguVoter,
} from "@/lib/riigikogu-types";
import {
  array,
  classifierCode,
  classifierLabel,
  cleanTitle,
  integer,
  record,
  sourceLink,
  tallinnDateTime,
  uuid,
} from "./riigikogu-parser.ts";

const CHOICES: Readonly<Record<string, RiigikoguVoteChoice>> = {
  POOLT: "in-favor",
  VASTU: "against",
  ERAPOOLETU: "neutral",
  EI_HAALETANUD: "did-not-vote",
  PUUDUB: "absent",
};

function parseDraft(value: unknown): RiigikoguDraftReference | null {
  if (!value || typeof value !== "object") return null;
  const draft = record(value, "vote draft");
  const id = uuid(draft.uuid, "vote draft UUID");
  return {
    id,
    mark: Number.isSafeInteger(draft.mark) ? Number(draft.mark) : null,
    title: cleanTitle(draft.title, "vote draft title"),
    sourceUrl: sourceLink(draft._links) ?? `https://api.riigikogu.ee/api/volumes/drafts/${id}`,
  };
}

export function parseVoteSummary(value: unknown): RiigikoguVoteSummary {
  const vote = record(value, "vote");
  const id = uuid(vote.uuid, "vote UUID");
  return {
    id,
    number: integer(vote.votingNumber, "vote number"),
    type: classifierLabel(vote.type) ?? "Määramata",
    description: cleanTitle(vote.description, "vote description"),
    startedAt: tallinnDateTime(vote.startDateTime, "vote start"),
    totals: {
      present: integer(vote.present, "present total"),
      absent: integer(vote.absent, "absent total"),
      inFavor: integer(vote.inFavor ?? 0, "in-favor total"),
      against: integer(vote.against ?? 0, "against total"),
      neutral: integer(vote.neutral ?? 0, "neutral total"),
      notVotingOrAbsent: integer(vote.abstained ?? 0, "not-voting total"),
    },
    draft: parseDraft(vote.relatedDraft),
    sourceUrl: sourceLink(vote._links) ?? `https://api.riigikogu.ee/api/votings/${id}`,
  };
}

export function parseVoteList(value: unknown): RiigikoguVoteSummary[] {
  const votes = array(value).flatMap((entry) => array(record(entry, "voting sitting").votings));
  return votes.map(parseVoteSummary)
    .filter((vote) => vote.totals.inFavor + vote.totals.against + vote.totals.neutral > 0)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export function parseVoters(value: unknown): RiigikoguVoter[] {
  return array(value).map((entry) => {
    const voter = record(entry, "voter");
    const decision = record(voter.decision, "voter decision");
    const officialCode = classifierCode(decision) ?? "UNKNOWN";
    const faction = voter.faction ? record(voter.faction, "voter faction") : null;
    return {
      memberId: uuid(voter.uuid, "voter UUID"),
      fullName: cleanTitle(voter.fullName, "voter name"),
      factionId: faction ? uuid(faction.uuid, "voter faction UUID") : null,
      factionName: faction ? cleanTitle(faction.name, "voter faction name") : null,
      choice: CHOICES[officialCode] ?? "unknown",
      officialCode,
      officialLabel: classifierLabel(decision) ?? officialCode,
    };
  });
}
