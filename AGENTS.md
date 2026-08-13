# 117.ee AI work guide

Use this file as the routing index. Open only the files named for the task, then
follow their direct imports. Do not preload whole feature trees.

## Start here

- Runtime: Next.js App Router, React, strict TypeScript, Tailwind.
- Pages: `/praegu` overview, `/` news, `/ilm` weather, `/reitingud` ratings,
  `/riigikogu` parliament, `/erakonnaraha` political money, and `/majandus`
  economy.
- Canonical API/type map: `docs/ai-data-contracts.md`.
- Product scope and remaining expansion: `docs/personal-terminal-roadmap.md`.
- Weather collector operations: `docs/weather-collector.md`.
- Human setup and product behavior: `README.md`.
- Use direct imports. Do not add barrel (`index.ts`) modules.
- Ignore `.next/`, `node_modules/`, `*.tsbuildinfo`, lockfiles, and binary assets
  unless the task specifically concerns dependencies, builds, or assets.
- Search with `rg`; read a narrow range before opening a large file in full.

## Task routing

### Shared shell, navigation, theme, metadata

- Start at `app/layout.tsx` and the affected page in `app/`.
- Follow the page's direct component imports only.
- Shared clock/theme/footer helpers live in `features/shell/client/`.
- Primary navigation definitions live in `features/shell/model/navigation.ts`;
  politics sub-navigation lives in `features/politics/client/politics-nav.tsx`.
- Preserve all five full desktop and mobile navigation labels and all three
  politics destinations.

### News UI or behavior

- Entry: `components/news-portal.tsx`.
- Focused client/model code: `features/news/client/` and
  `features/news/model/`; server adapters: `features/news/server/`; follow the
  entry module's direct imports.
- Domain contracts: `lib/types.ts`; collection cap: `lib/news-collections.ts`.
- Grouping facade: `lib/group-stories.ts`; title scoring:
  `lib/story-title-similarity.ts`; feed labels/links: `lib/feed-*.ts`.
- Server ingestion: `app/api/news/route.ts`.
- Tests: `tests/feed-*.test.ts`, `tests/group-stories.test.ts`,
  `tests/news-client-model.test.ts`, and `tests/news-collections.test.ts`.

### Weather UI, history, chart, or radar

- Entry: `components/weather-portal.tsx`; radar entry:
  `components/weather-radar.tsx`.
- Focused weather UI: `features/weather/client/`; radar UI/model:
  `features/weather/radar/`; source orchestration: `features/weather/server/`.
- Contracts: `lib/weather-types.ts`; parsing/merge: `lib/weather-data.ts`.
- History/ranges/CSV: `lib/weather-history.ts`; chart navigation:
  `lib/weather-chart.ts`; Tallinn time: `lib/weather-time.ts`.
- Radar data/geometry: `lib/radar.ts`.
- API entries: `app/api/weather/route.ts`, `app/api/weather/history/route.ts`,
  and `app/api/weather/radar/route.ts`.
- Persistence/auth: `lib/weather-store.ts` and `lib/weather-route-policy.ts`.
- Tests: `tests/weather-*.test.ts` and `tests/radar.test.ts`.

### Ratings, seats, or coalition lab

- Entry: `components/ratings-portal.tsx`; chamber:
  `components/riigikogu-seat-map.tsx`.
- Focused client/model code: `features/ratings/client/` and
  `features/ratings/model/`; follow the portal's direct imports.
- API contract: `lib/ratings-types.ts`; source adapter:
  `lib/norstat-ratings.ts`; focused server code: `features/ratings/server/`;
  bounded readers: `lib/ratings-response.ts` and `lib/bounded-response.ts`.
- Projection: `lib/seat-projection.ts`; geometry: `lib/riigikogu-layout.ts`.
- Server entry: `app/api/ratings/route.ts`.
- Tests: `tests/bounded-response.test.ts`, `tests/norstat-ratings.test.ts`,
  `tests/ratings-response.test.ts`, `tests/ratings-view-model.test.ts`,
  `tests/seat-projection.test.ts`, and `tests/riigikogu-layout.test.ts`.

### Praegu overview or local watchlists

- Entry: `components/now-portal.tsx`; contract: `lib/now-types.ts`; server
  composition: `features/now/server/now-route.server.ts`.
- Deterministic cards and per-stream seen state: `features/now/model/`.
- Watch storage/matching: `features/watchlist/model/watchlist.ts`; provider and
  controls: `features/watchlist/client/`.
- Weather-warning contract: `lib/weather-warning-types.ts`; official adapter:
  `features/weather/server/weather-warning.server.ts`.
- Storage keys are `117-now-seen-v1` and `117-watchlists-v1`; neither preference
  document may be uploaded or added to URLs/logs.
- Tests: `tests/now.test.ts`, `tests/watchlist.test.ts`, and
  `tests/weather-warning.test.ts`.

### Economy dashboard

- Entry: `components/economy-portal.tsx`; contract: `lib/economy-types.ts`.
- Statistics Estonia source registry/adapters: `features/economy/server/`;
  comparisons and classification: `features/economy/model/`.
- Server entry: `app/api/economy/route.ts`.
- Keep table IDs, dimensions, units, geography, frequency, price basis,
  adjustment, release status, attribution, and derivations explicit.
- Tests: `tests/economy-*.test.ts`.

### Riigikogu Live

- Entry: `components/riigikogu-portal.tsx`; contract:
  `lib/riigikogu-types.ts`; source/parser/cache modules:
  `features/riigikogu/server/`; faction calculations in
  `features/riigikogu/model/`.
- API entries: `app/api/riigikogu/route.ts` plus lazy `votes/[id]` and
  `bills/[id]` routes.
- Preserve official UUIDs and distinct vote states. Obey the shared upstream
  scheduler; do not bypass the published Riigikogu rate limits.
- Tests: `tests/riigikogu-*.test.ts`.

### Political financing

- Entry: `components/political-finance-portal.tsx`; contract:
  `lib/political-finance-types.ts`; ERJK adapters/parsers:
  `features/political-finance/server/`; pure aggregation in
  `features/political-finance/model/`.
- API entries: `app/api/political-finance/route.ts` and capped filtered records.
- Keep filings/revisions, source party labels, categories, public donor fields,
  attribution, and neutral descriptive wording intact. Never enrich identities.
- Tests: `tests/political-finance-*.test.ts`.

## Non-negotiable invariants

- News: validate upstream hosts/redirects, bound response sizes, tolerate a
  single failed feed, and retain explicit partial-source status.
- Weather: never present modeled values as observations; keep source, kind,
  attribution, Tallinn-time, range, and collector-auth semantics intact.
- Ratings: validate the documented source schema; keep the 5% inclusive
  threshold, 101 seats, modified D'Hondt exponent `0.9`, and deterministic ties.
- Political identities come from `lib/party-registry.ts`; dated coalition state
  comes from `lib/political-context.ts`. Source aliases remain in adapters.
- Overview: one failed area must not erase other cards; server output stays
  non-personal and browser seen/watch state updates only after usable data loads.
- API work must preserve timeouts, size limits, cache/stale behavior, safe error
  details, and `no-store` on authenticated or failure responses.
- Do not expose `DATABASE_URL`, `WEATHER_COLLECTOR_TOKEN`, upstream payloads, or
  sensitive headers to client code, URLs, logs, fixtures, or documentation.
- Keep browser storage keys and accessible keyboard/focus behavior compatible
  unless the task explicitly changes them.

## Validation

- One test file: `npm run test:file -- tests/<name>.test.ts`.
- Feature suites: `npm run test:news`, `npm run test:weather`,
  `npm run test:ratings`, `npm run test:economy`, `npm run test:riigikogu`,
  `npm run test:now`, or `npm run test:political-finance`.
- Context guard: `npm run check:context`.
- Before handoff: run the affected suite, `npm test`, `npm run typecheck`, and
  `npm run build`; report any command not run.
- Keep ordinary modules within 300 lines/12k characters, complex visual modules
  within 400/20k, portal facades within 200/8k, and route handlers within
  100/4k. Any temporary legacy ceiling must be explicit in
  `scripts/check-context.mjs` and removed after that file is split.
