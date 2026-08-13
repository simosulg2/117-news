export type NowArea = "news" | "weather" | "ratings" | "riigikogu" | "economy" | "political-finance";
export type NowSourceStatus = "ok" | "partial" | "stale" | "unavailable";

export type NowCard = {
  id: string;
  revisionId: string;
  area: NowArea;
  priority: number;
  happenedAt: string;
  headline: string;
  detail: string;
  targetUrl: string;
  sourceUrl: string;
  sourceLabel: string;
  entityIds: string[];
  eventKind: "news" | "weather-observation" | "party-rating" | "party-threshold" | "coalition-majority" | "riigikogu" | "economy" | "weather-warning" | "political-finance";
  crossedThreshold?: boolean;
  hasMajority?: boolean;
  majorityChanged?: boolean;
  seatCounts?: Record<string, number>;
  previousSeatCounts?: Record<string, number>;
  partyMetrics?: Record<string, { name: string; support: number; previousSupport: number | null; change: number | null }>;
  financePartyMetrics?: Record<string, {
    name: string;
    income: number | null;
    expenses: number | null;
    donations: number | null;
    revisionId: string;
    sourceUrl: string;
  }>;
  financeDonorMetrics?: Record<string, { name: string; amount: number; partyId: string; partyName: string; revisionId: string }>;
  riigikoguMemberMetrics?: Record<string, { name: string; choice: string; factionId: string | null; factionName: string | null }>;
  riigikoguFactionMetrics?: Record<string, { name: string; inFavor: number; against: number; neutral: number; absent: number; didNotVote: number }>;
  watchTarget: {
    kind: "news-source" | "party-rating" | "riigikogu-bill" | "economy-indicator" | "weather-warning" | "political-finance-party" | "political-finance-donor";
    targetId: string;
    label: string;
  } | null;
};

export type NowResponse = {
  cards: NowCard[];
  sources: Array<{ area: NowArea; status: NowSourceStatus }>;
  generatedAt: string;
};
