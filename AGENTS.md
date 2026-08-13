# 117.ee AI work guide

Use this file as the routing index. Open only the files named for the task, then
follow their direct imports. Do not preload whole feature trees.

## Start here

- Runtime: Next.js App Router, React, strict TypeScript, Tailwind.
- Pages: `/` news, `/ilm` weather, `/reitingud` ratings.
- Canonical API/type map: `docs/ai-data-contracts.md`.
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
- Preserve all three desktop and mobile navigation destinations.

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

## Non-negotiable invariants

- News: validate upstream hosts/redirects, bound response sizes, tolerate a
  single failed feed, and retain explicit partial-source status.
- Weather: never present modeled values as observations; keep source, kind,
  attribution, Tallinn-time, range, and collector-auth semantics intact.
- Ratings: validate the documented source schema; keep the 5% inclusive
  threshold, 101 seats, modified D'Hondt exponent `0.9`, and deterministic ties.
- API work must preserve timeouts, size limits, cache/stale behavior, safe error
  details, and `no-store` on authenticated or failure responses.
- Do not expose `DATABASE_URL`, `WEATHER_COLLECTOR_TOKEN`, upstream payloads, or
  sensitive headers to client code, URLs, logs, fixtures, or documentation.
- Keep browser storage keys and accessible keyboard/focus behavior compatible
  unless the task explicitly changes them.

## Validation

- One test file: `npm run test:file -- tests/<name>.test.ts`.
- Feature suites: `npm run test:news`, `npm run test:weather`, or
  `npm run test:ratings`.
- Context guard: `npm run check:context`.
- Before handoff: run the affected suite, `npm test`, `npm run typecheck`, and
  `npm run build`; report any command not run.
- Keep ordinary modules within 300 lines/12k characters, complex visual modules
  within 400/20k, portal facades within 200/8k, and route handlers within
  100/4k. Any temporary legacy ceiling must be explicit in
  `scripts/check-context.mjs` and removed after that file is split.
