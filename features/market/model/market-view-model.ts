import type {
  MarketOpportunity,
  MarketSnapshot,
  MarketWindowState,
} from "../../../lib/market-types.ts";
import {
  calculateTradingSignal,
  LIVE_QUOTE_MAX_AGE_SECONDS,
  type TradingSignal,
} from "./market-opportunities.ts";

export type MarketRowView = Readonly<{
  opportunity: MarketOpportunity;
  signal: TradingSignal | null;
  reliable: boolean;
  highlighted: boolean;
  actionable: boolean;
}>;

export function buildMarketRows(
  snapshot: MarketSnapshot,
  tradeAmountEur: number,
  minimumGapPercent: number,
  window: MarketWindowState = snapshot.window,
): readonly MarketRowView[] {
  const fxFresh = snapshot.eurUsdAgeSeconds !== null
    && snapshot.eurUsdAgeSeconds <= LIVE_QUOTE_MAX_AGE_SECONDS;
  return snapshot.opportunities.map((opportunity) => {
    const signal = opportunity.gapPercent === null
      ? null
      : calculateTradingSignal(
        opportunity.gapPercent,
        tradeAmountEur,
        minimumGapPercent,
      );
    const reliable = opportunity.referenceIsToday
      && opportunity.usQuoteAgeSeconds !== null
      && opportunity.usQuoteAgeSeconds <= LIVE_QUOTE_MAX_AGE_SECONDS
      && fxFresh;
    const highlighted = Boolean(signal?.strong && reliable);
    return {
      opportunity,
      signal,
      reliable,
      highlighted,
      actionable: highlighted && window === "open",
    };
  });
}
