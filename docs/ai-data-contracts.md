# AI data-contract map

This is a routing aid, not a second schema definition. Treat the linked TypeScript
types and tests as canonical. Follow direct imports; do not create barrel modules.

## News (`GET/POST /api/news`)

- Contract owner: `lib/types.ts` (`NewsResponse`, `NewsItem`,
  `NewsStoryDetailResponse`, `FeedFailure`).
- Server entry: `app/api/news/route.ts`.
- Lazy story detail: `GET /api/news/stories/[id]`.
- Focused source modules: `features/news/server/`.
- Pure policy: `lib/feed-links.ts`, `lib/feed-retry.ts`,
  `lib/feed-categories.ts`, `lib/group-stories.ts`, and
  `lib/news-collections.ts`; durable matching belongs to
  `features/news/model/story-evolution.ts`.
- Consumer entry: `components/news-portal.tsx`; focused client/model code:
  `features/news/`.

`GET /api/news` is read-only. Its response can be successful with failed feeds;
`sources` must retain loaded, total, and public failure information. Each view
is capped at 117 items. Upstream redirects and article URLs stay
host-restricted, bodies stay bounded, and cached snapshots may be served while
a refresh fails. `storyHistory` states whether the response uses durable
PostgreSQL associations or the in-memory snapshot fallback. With persistence,
an all-feeds-failed refresh may use retained active-story metadata without
presenting it as a fresh feed result.

`POST /api/news` is the server-only collector. It requires a constant-time
checked Bearer token from `NEWS_COLLECTOR_TOKEN`, stores bounded feed metadata in
PostgreSQL, and returns `no-store`. Matching only considers active stories from
the preceding 72 hours; retained story history is deleted after 30 days. Keep
credentials, raw upstream bodies, and authorization details out of client code,
URLs, errors, and logs. Operational setup lives in `docs/news-collector.md`.
Matching normally stays within one category. An exact same-source title may
bridge a source-category disagreement, and high-confidence context evidence may
reconcile a previously split singleton story. Reconciliation must never rewrite
or delete a story that contains more than one stored article.

Story details load only when requested through `GET /api/news/stories/[id]`.
The response is capped at 40 coverage events and 117 articles and exposes
`truncated` when the cap applies. Associations are deterministic metadata
matches, not causal claims. Do not scrape article bodies or add AI-generated
summaries, interpretation, or inferred relationships.

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

- Canonical party presentation: `lib/party-registry.ts`.
- Riigikogu and ERJK aliases remain in their source adapters and resolve to the
  same canonical IDs. Unknown source identities remain explicit rather than
  being guessed.

## Riigikogu (`GET /api/riigikogu`)

- Contract: `lib/riigikogu-types.ts`.
- Source scheduler, parsers, and cache: `features/riigikogu/server/`.
- Lazy details: `GET /api/riigikogu/votes/[id]` and
  `GET /api/riigikogu/bills/[id]`.
- Consumer: `components/riigikogu-portal.tsx`.

The overview discovers the current membership from the official API and uses
that membership consistently for bills, members, and UI labels. Official UUIDs remain stable;
`in-favor`, `against`, `neutral`, `did-not-vote`, `absent`, and unknown choices
stay distinct. Faction plurality/deviation is a labeled deterministic
derivation, not an official judgment. Preserve CC BY-SA 3.0 attribution and the
centralized upstream rate scheduler.

Validate with `npm run test:riigikogu`.

## Political financing (`GET /api/political-finance`)

- Contract: `lib/political-finance-types.ts`.
- ERJK config, client, and parsers: `features/political-finance/server/`.
- Aggregation and revision logic: `features/political-finance/model/`.
- Capped detail: `GET /api/political-finance/records`.
- Consumer: `components/political-finance-portal.tsx`.

Overview data are quarterly filings, not live transactions. Corrections replace
the same filing through revision IDs. Preserve reported and canonical party
identities, category/entity distinctions, only officially public donor fields,
neutral wording, report links, and CC BY-SA 3.0 attribution. Detail filters and
page size are allowlisted and bounded.

Validate with `npm run test:political-finance`.

## Private schedule (`/ajakava`)

- Contract: `lib/schedule-types.ts`.
- Strict validation and pure time/metric logic: `features/schedule/model/`.
- Authenticated encrypted source: `features/schedule/server/`.
- Authentication policy and server authorization boundary: `features/auth/server/`.
- Consumer: `components/schedule-portal.tsx`.

The schedule has no public API. Require the authorized session before loading
or decrypting data. Keep the workbook, plaintext JSON, OAuth credentials,
allowlisted account ID, session material, and schedule key outside client code,
logs, URLs, fixtures, and Git history. Private responses remain dynamic and
non-cacheable; missing configuration fails closed without affecting public
features.

Validate with `npm run test:schedule`.

## Cross-cutting change rule

When a public shape changes, update its canonical type, parser/producer,
consumer, and focused tests together. Do not paste schemas, source URLs, live
values, or implementation excerpts into AI docs; link to the owning module so
future agents read one source of truth.
