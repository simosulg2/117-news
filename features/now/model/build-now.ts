import type { EconomyResponse } from "../../../lib/economy-types.ts";
import type { NowCard } from "../../../lib/now-types.ts";
import type { PoliticalFinanceResponse } from "../../../lib/political-finance-types.ts";
import type { RatingsResponse } from "../../../lib/ratings-types.ts";
import type { RiigikoguOverviewResponse, RiigikoguVoteDetail } from "../../../lib/riigikogu-types.ts";
import type { NewsResponse } from "../../../lib/types.ts";
import type { WeatherResponse } from "../../../lib/weather-types.ts";
import type { WeatherWarningsResponse } from "../../../lib/weather-warning-types.ts";
import {
  buildEconomyNowCard,
  buildFinanceNowCard,
  buildNewsNowCard,
  buildWeatherNowCard,
} from "./now-core-card-builders.ts";
import { buildRatingsNowCard, buildRiigikoguNowCards } from "./now-politics-card-builders.ts";
import { nowTimestamp } from "./now-card-utils.ts";

export type NowInputs = {
  news?: NewsResponse;
  weather?: WeatherResponse;
  ratings?: RatingsResponse;
  warnings?: WeatherWarningsResponse;
  riigikogu?: RiigikoguOverviewResponse;
  riigikoguVote?: RiigikoguVoteDetail;
  economy?: EconomyResponse;
  politicalFinance?: PoliticalFinanceResponse;
  extraCards?: readonly NowCard[];
};

export function buildNowCards(inputs: NowInputs, nowMs = Date.now()): NowCard[] {
  const cards = [
    inputs.news ? buildNewsNowCard(inputs.news) : null,
    inputs.weather || inputs.warnings ? buildWeatherNowCard(inputs.weather, inputs.warnings, nowMs) : null,
    inputs.ratings ? buildRatingsNowCard(inputs.ratings) : null,
    ...(inputs.riigikogu ? buildRiigikoguNowCards(inputs.riigikogu, inputs.riigikoguVote, nowMs) : []),
    inputs.economy ? buildEconomyNowCard(inputs.economy) : null,
    inputs.politicalFinance ? buildFinanceNowCard(inputs.politicalFinance) : null,
    ...(inputs.extraCards ?? []),
  ].filter((card): card is NowCard => card !== null);
  return cards.sort((left, right) => right.priority - left.priority
    || nowTimestamp(right.happenedAt) - nowTimestamp(left.happenedAt) || left.id.localeCompare(right.id));
}
