# AI data-contract map

This is a routing aid, not a second schema definition. Treat the linked TypeScript
types and tests as canonical. Follow direct imports; do not create barrel modules.

## News (`GET /api/news`)

- Contract owner: `lib/types.ts` (`NewsResponse`, `NewsItem`, `FeedFailure`).
- Server entry: `app/api/news/route.ts`.
- Focused source modules: `features/news/server/`.
- Pure policy: `lib/feed-links.ts`, `lib/feed-retry.ts`,
  `lib/feed-categories.ts`, `lib/group-stories.ts`, and
  `lib/news-collections.ts`.
- Consumer entry: `components/news-portal.tsx`; focused client/model code:
  `features/news/`.

The response can be successful with failed feeds; `sources` must retain loaded,
total, and public failure information. Each view is capped at 117 items. Related
coverage is nested under one primary item and must remain inside the grouping
window. Upstream redirects and article URLs stay host-restricted, bodies stay
bounded, and cached snapshots may be served while a refresh fails.

Validate with `npm run test:news`.

## Weather (`GET/POST /api/weather`)

- Contract owner: `lib/weather-types.ts` (`WeatherResponse`, `WeatherPoint`).
- Server entry: `app/api/weather/route.ts`.
- Parsing and source merge: `lib/weather-data.ts`.
- Focused model/source modules: `features/weather/model/` and
  `features/weather/server/`.
- Shared bounded upstream reader: `lib/bounded-response.ts`.
- Persistence: `lib/weather-store.ts`; collector authorization and public
  outcomes: `lib/weather-route-policy.ts`.
- Consumer entry: `components/weather-portal.tsx`.
- Focused client modules: `features/weather/client/`.

`GET` combines official current/history data, modeled Open-Meteo data, stored
observations, source status, and attribution. A point's `kind` and `source` are
semantic: modeled data must never be relabeled as observed. Station identity is
Võru/WMO 26249 and displayed times use `Europe/Tallinn`.

`POST` is the server-only collector. It requires a constant-time checked Bearer
token from `WEATHER_COLLECTOR_TOKEN`, stores a current official observation, and
returns `no-store`. Keep credentials and authorization details out of errors and
logs. Operational setup lives in `docs/weather-collector.md`.

## Weather history (`GET /api/weather/history`)

- Contract owner: `lib/weather-types.ts` (`WeatherHistoryResponse`).
- Range, aggregation, nearest-point, and CSV rules: `lib/weather-history.ts`.
- Server entry: `app/api/weather/history/route.ts`.

`from` and `to` are explicit ISO timestamps. The maximum requested range is 90
days. Detail is retained for short ranges; longer chart output is hourly. Partial
coverage must stay explicit in `partial`, `coverage`, and per-source status.

## Radar (`GET /api/weather/radar`)

- Timeline/frame parser and constants: `lib/radar.ts`.
- Server entry: `app/api/weather/radar/route.ts`.
- Consumer entry: `components/weather-radar.tsx`.
- Focused radar modules: `features/weather/radar/`; source/cache modules:
  `features/weather/server/radar-*.ts`.

Frames distinguish observed from forecast data. Observations use the official
EPSG:3301 static tile grid; forecasts use aligned, tiled WMS requests. Preserve
official notices, attribution, bounded upstream requests, stale fallback, and
the official tile/WMS host allowlists.

Validate all weather contracts with `npm run test:weather`.

## Ratings (`GET /api/ratings`)

- Contract owner: `lib/ratings-types.ts` (`RatingsResponse`, `RatingsPoll`).
- Source registry/parser: `lib/norstat-ratings.ts`.
- Focused source schema/registry/parser: `features/ratings/server/norstat-*.ts`.
- Bounded HTTP body policy: `lib/ratings-response.ts`.
- Snapshot policy: `lib/snapshot-cache.ts`.
- Server entry: `app/api/ratings/route.ts`.
- Consumer entry: `components/ratings-portal.tsx`; focused client/model code:
  `features/ratings/`.

The adapter validates source schema version 3 and returns the latest rolling
four-week wave plus its previous comparable wave. Party IDs are stable app IDs;
`sourceName` is unmodified attribution. Nullable values remain nullable. The API
uses an hourly in-process snapshot and may serve the last good snapshot after an
upstream failure; response headers disclose snapshot state.

Seat allocation is a derived model, not part of the polling contract. Its owner
is `lib/seat-projection.ts`: exactly 101 seats, an inclusive 5% threshold,
modified D'Hondt divisors with exponent `0.9`, and deterministic tie-breaking.
Chamber geometry belongs to `lib/riigikogu-layout.ts`.

Validate with `npm run test:ratings`.

## Shared political identities

- Canonical static presentation: `lib/party-registry.ts`.
- Dated government membership: `lib/political-context.ts`.
- Norstat, Riigikogu, and ERJK aliases remain in their source adapters and resolve
  to the same canonical IDs. Unknown source identities remain explicit rather
  than being guessed.

## Weather warnings (`GET /api/weather/warnings`)

- Contract: `lib/weather-warning-types.ts`.
- Official XML adapter/cache: `features/weather/server/weather-warning.server.ts`.
- Consumers: the weather desk and `/praegu`.

Only national, Võru County, and explicitly allowlisted Võru County municipality
warnings are returned. Level, area, validity and source revision remain explicit.
Expired warnings are removed; active and upcoming warnings stay distinct. A
national text notice without an official numeric level uses `level: null`;
consumers must not infer a level. Empty official XML is a successful no-warning
state; schema drift fails closed and stale cache may be served.

## Economy (`GET /api/economy`)

- Contract: `lib/economy-types.ts`.
- Approved table/series registry and PxWeb adapters: `features/economy/server/`.
- Comparison/classification policy: `features/economy/model/`.
- Consumer: `components/economy-portal.tsx`.

The response groups prices, income, work, output, trade, and Võrumaa indicators.
Every indicator retains unit, geography, period/frequency, price basis,
adjustment, release/revision state, derivation, table ID, direct source link,
freshness, and CC BY-SA 4.0 attribution. Groups fail independently.

Validate with `npm run test:economy`.

## Riigikogu (`GET /api/riigikogu`)

- Contract: `lib/riigikogu-types.ts`.
- Source scheduler/parsers/cache: `features/riigikogu/server/`.
- Lazy details: `GET /api/riigikogu/votes/[id]` and
  `GET /api/riigikogu/bills/[id]`.
- Consumer: `components/riigikogu-portal.tsx`.

The overview is scoped to the XV Riigikogu. Official UUIDs remain stable;
`in-favor`, `against`, `neutral`, `did-not-vote`, `absent`, and unknown choices
stay distinct. Faction plurality/deviation is a labeled deterministic derivation,
not an official judgment. Preserve CC BY-SA 3.0 attribution and the centralized
upstream rate scheduler.

Validate with `npm run test:riigikogu`.

## Praegu (`GET /api/now`) and watchlists

- Compact card contract: `lib/now-types.ts`.
- Direct cache-aware composition: `features/now/server/now-route.server.ts`.
- Deterministic selection/personalization: `features/now/model/`.
- Local watch contract and matching: `features/watchlist/model/watchlist.ts`.

The API composes typed server services directly and returns no personal state.
Each card carries stable event/revision IDs, priority, time, local/official links,
and source area. Per-stream seen markers use `117-now-seen-v1`; versioned local
watches and bounded seen matches use `117-watchlists-v1`. Both remain in the
browser and never belong in API requests, URLs, analytics, or logs.

Validate with `npm run test:now`.

## Political financing (`GET /api/political-finance`)

- Contract: `lib/political-finance-types.ts`.
- ERJK config/client/parsers: `features/political-finance/server/`.
- Aggregation/revisions: `features/political-finance/model/`.
- Capped detail: `GET /api/political-finance/records`.
- Consumer: `components/political-finance-portal.tsx`.

Overview data are quarterly filings, not live transactions. Corrections replace
the same filing through revision IDs. Preserve reported and canonical party
identities, category/entity distinctions, only officially public donor fields,
neutral wording, report links, and CC BY-SA 3.0 attribution. Detail filters and
page size are allowlisted and bounded.

Validate with `npm run test:political-finance`.

## Cross-cutting change rule

When a public shape changes, update its canonical type, parser/producer,
consumer, and focused tests together. Do not paste schemas, source URLs, live
values, or implementation excerpts into AI docs; link to the owning module so
future agents read one source of truth.
