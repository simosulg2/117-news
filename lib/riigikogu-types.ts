export const RIIGIKOGU_SOURCE_URL = "https://api.riigikogu.ee";
export const RIIGIKOGU_OPEN_DATA_URL = "https://www.riigikogu.ee/avaandmed/";
export const RIIGIKOGU_LICENCE_URL = "https://creativecommons.org/licenses/by-sa/3.0/";

export type RiigikoguSourceState = "ok" | "partial" | "stale";

export type RiigikoguAttribution = {
  name: "Riigikogu Kantselei avaandmed";
  sourceUrl: typeof RIIGIKOGU_OPEN_DATA_URL;
  licence: "CC BY-SA 3.0";
  licenceUrl: typeof RIIGIKOGU_LICENCE_URL;
  retrievedAt: string;
};

export type RiigikoguDraftReference = {
  id: string;
  mark: number | null;
  title: string;
  sourceUrl: string;
};

export type RiigikoguAgendaItem = {
  id: string;
  order: number;
  title: string;
  type: string | null;
  stage: string | null;
  decision: string | null;
  draft: RiigikoguDraftReference | null;
};

export type RiigikoguSitting = {
  id: string;
  title: string;
  startsAt: string;
  items: RiigikoguAgendaItem[];
};

export type RiigikoguAgenda = {
  weekStart: string;
  weekEnd: string;
  title: string | null;
  sittings: RiigikoguSitting[];
};

export type RiigikoguVoteTotals = {
  present: number;
  absent: number;
  inFavor: number;
  against: number;
  neutral: number;
  notVotingOrAbsent: number;
};

export type RiigikoguVoteSummary = {
  id: string;
  number: number;
  type: string;
  description: string;
  startedAt: string;
  totals: RiigikoguVoteTotals;
  draft: RiigikoguDraftReference | null;
  sourceUrl: string;
};

export type RiigikoguBillSummary = {
  id: string;
  mark: number | null;
  title: string;
  typeCode: string | null;
  stageCode: string | null;
  statusCode: string | null;
  statusDate: string | null;
  initiatedAt: string | null;
  leadingCommittee: string | null;
  sourceUrl: string;
};

export type RiigikoguFactionSummary = {
  id: string;
  name: string;
  partyId: string | null;
  memberCount: number;
};

export type RiigikoguOverviewResponse = {
  membership: number | null;
  state: RiigikoguSourceState;
  generatedAt: string;
  agenda: RiigikoguAgenda | null;
  votes: RiigikoguVoteSummary[];
  bills: RiigikoguBillSummary[];
  factions: RiigikoguFactionSummary[];
  unavailable: Array<"agenda" | "votes" | "bills" | "members">;
  attribution: RiigikoguAttribution;
};

export type RiigikoguVoteChoice =
  | "in-favor"
  | "against"
  | "neutral"
  | "did-not-vote"
  | "absent"
  | "unknown";

export type RiigikoguVoter = {
  memberId: string;
  fullName: string;
  factionId: string | null;
  factionName: string | null;
  choice: RiigikoguVoteChoice;
  officialCode: string;
  officialLabel: string;
};

export type RiigikoguFactionVote = {
  factionId: string;
  factionName: string;
  totals: Record<RiigikoguVoteChoice, number>;
  plurality: Exclude<RiigikoguVoteChoice, "did-not-vote" | "absent" | "unknown"> | null;
  deviations: string[];
};

export type RiigikoguVoteDetail = RiigikoguVoteSummary & {
  voters: RiigikoguVoter[];
  factions: RiigikoguFactionVote[];
  reconciles: boolean;
  attribution: RiigikoguAttribution;
};

export type RiigikoguBillEvent = {
  readingCode: string;
  happenedAt: string;
  sourceUrl: string | null;
};

export type RiigikoguBillDocument = {
  title: string;
  sourceUrl: string;
};

export type RiigikoguBillDetail = RiigikoguBillSummary & {
  initialTitle: string | null;
  initiators: string[];
  amendmentsDeadline: string | null;
  acceptedAt: string | null;
  events: RiigikoguBillEvent[];
  documents: RiigikoguBillDocument[];
  attribution: RiigikoguAttribution;
};

export type RiigikoguUnavailableResponse = { error: string };
