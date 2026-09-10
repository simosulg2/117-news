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

export type MarketDirectionFilter = "all" | "buy" | "sell" | "reliable";
export type MarketSortOrder =
  | "absolute-gap"
  | "buy-gap"
  | "sell-gap"
  | "freshest"
  | "name";

export type MarketListOptions = Readonly<{
  showAll: boolean;
  query: string;
  directionFilter: MarketDirectionFilter;
  sortOrder: MarketSortOrder;
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

function compareNumbers(left: number | null, right: number | null, ascending: boolean): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return ascending ? left - right : right - left;
}

function compareRows(left: MarketRowView, right: MarketRowView, sortOrder: MarketSortOrder): number {
  const leftGap = left.opportunity.gapPercent;
  const rightGap = right.opportunity.gapPercent;
  let compared = 0;
  if (sortOrder === "absolute-gap") {
    compared = compareNumbers(leftGap === null ? null : Math.abs(leftGap), rightGap === null ? null : Math.abs(rightGap), false);
  } else if (sortOrder === "buy-gap") {
    compared = compareNumbers(leftGap, rightGap, false);
  } else if (sortOrder === "sell-gap") {
    compared = compareNumbers(leftGap, rightGap, true);
  } else if (sortOrder === "freshest") {
    compared = compareNumbers(left.opportunity.usQuoteAgeSeconds, right.opportunity.usQuoteAgeSeconds, true);
  } else {
    compared = left.opportunity.name.localeCompare(right.opportunity.name, "et", { sensitivity: "base" });
  }
  if (compared !== 0) return compared;
  return left.opportunity.name.localeCompare(right.opportunity.name, "et", { sensitivity: "base" });
}

export function filterAndSortMarketRows(
  rows: readonly MarketRowView[],
  options: MarketListOptions,
): readonly MarketRowView[] {
  const query = options.query.trim().toLocaleLowerCase("et");
  return rows
    .filter((row) => options.showAll || row.highlighted)
    .filter((row) => {
      if (options.directionFilter === "reliable") return row.reliable;
      if (options.directionFilter === "all") return true;
      return row.signal?.direction === options.directionFilter;
    })
    .filter((row) => {
      if (!query) return true;
      const { opportunity } = row;
      return [
        opportunity.name,
        opportunity.id,
        opportunity.xetraSymbol,
        opportunity.usSymbol,
        opportunity.isin,
      ].some((value) => value.toLocaleLowerCase("et").includes(query));
    })
    .sort((left, right) => compareRows(left, right, options.sortOrder));
}
