export type MarketWindowState = "before" | "open" | "closed" | "weekend";

export type MarketPrice = Readonly<{
  value: number;
  at: string;
}>;

export type MarketOpportunity = Readonly<{
  id: string;
  name: string;
  isin: string;
  xetraSymbol: string;
  usSymbol: string;
  investingUrl: string;
  usUnits: number;
  reference: MarketPrice | null;
  auction: MarketPrice | null;
  usPrice: MarketPrice | null;
  impliedEur: number | null;
  gapPercent: number | null;
  referenceTradeMinutesBeforeClose: number | null;
  referenceIsToday: boolean;
  usQuoteAgeSeconds: number | null;
  issues: readonly string[];
}>;

export type MarketSnapshot = Readonly<{
  fetchedAt: string;
  window: MarketWindowState;
  eurUsd: MarketPrice | null;
  eurUsdAgeSeconds: number | null;
  opportunities: readonly MarketOpportunity[];
  availableCount: number;
  instrumentCount: number;
  source: "yahoo";
}>;

export type MarketRefreshResult =
  | Readonly<{ ok: true; snapshot: MarketSnapshot }>
  | Readonly<{ ok: false; error: string }>;
