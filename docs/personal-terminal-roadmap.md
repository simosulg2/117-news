# 117.ee personal terminal roadmap

Status: core milestones 0–5 implemented on 2026-08-13. Unchecked items below are
intentional follow-up expansions or explicitly deferred optional views; do not
rebuild checked work. Live contracts and routing are indexed in
`docs/ai-data-contracts.md` and `AGENTS.md`.

This document is the execution plan for turning 117.ee into a personal Estonia
information terminal. Future work should implement one unchecked milestone at a
time, keep every milestone deployable, and avoid reopening product scope unless
an official source is no longer usable.

## Product goal

Answer three questions without opening multiple sites:

1. What changed since the last visit?
2. What do official data say about Estonian politics and the economy?
3. What matters right now in the user's existing interests: news, Võru weather,
   political power, parliamentary activity, and the economy?

Approved additions, in delivery order:

1. `Majandus`
2. `Riigikogu Live`
3. `/praegu`
4. Local personal watchlists
5. Political financing

Explicitly out of scope:

- electricity-price tooling;
- a tax or party-policy calculator;
- accounts, cloud profiles, email, SMS, or push notifications in v1;
- generic buses, events, road, stock-market, or lifestyle widgets;
- AI-generated political or economic claims without a deterministic source.

## Information architecture

Preserve all current routes and bookmarks.

| Area | Route | Plan |
| --- | --- | --- |
| News | `/` | Keep as the existing news desk. Do not make `/praegu` the homepage automatically. |
| Weather | `/ilm` | Keep the current advanced Võru weather desk. |
| Ratings | `/reitingud` | Keep the existing route and projection behavior. |
| Economy | `/majandus` | New top-level economic dashboard. |
| Parliament | `/riigikogu` | New live parliamentary dashboard. |
| Overview | `/praegu` | New compact cross-feature change overview. |
| Political money | `/erakonnaraha` | New financing dashboard after watchlists. |

When `/riigikogu` ships, change the top-level navigation label `Reitingud` to
`Poliitika`, but keep its target `/reitingud`. Add a shared politics sub-navigation
to `/reitingud`, `/riigikogu`, and later `/erakonnaraha`:

`Reitingud · Riigikogu · Raha`

The top-level navigation after phases 1–3 is:

`Praegu · Uudised · Ilm · Poliitika · Majandus`

On small screens it must remain horizontally scrollable with full labels. Do not
truncate `Reitingud`, `Poliitika`, or `Majandus` to ambiguous abbreviations.

## Shared implementation rules

- External data is fetched only by server modules and exposed through internal
  App Router APIs.
- Every source adapter validates schema, time, units, and identifiers before data
  reaches a client component.
- Preserve source name/URL, licence, source record/table ID, period,
  publication/update time, retrieval time, unit, geography, frequency,
  `provisional`/`final`/`forecast` status, and revision/stale state in normalized
  contracts.
- Use bounded responses, explicit timeouts, approved-host and redirect checks,
  cache TTLs appropriate to source cadence, and last-known-good fallback.
- Confirm the production hosting model before relying on process-local cache or
  rate limiting. A horizontally scaled/cold-instance deployment needs a shared
  cache/lock for strict upstream limits and cross-restart last-known-good data.
- A partial source failure must not blank unrelated cards or sections.
- Show the age of the source observation/release, not merely the server retrieval
  time.
- Derived values must expose their formula and input periods. Never combine
  mismatched monthly, quarterly, nominal, real, national, or county series.
- Use Europe/Tallinn for display, UTC ISO strings in contracts, and stable source
  IDs for comparison.
- Keep source-specific parsing in `features/<feature>/server/`, pure calculations
  in `features/<feature>/model/`, client state in `features/<feature>/client/`, and
  public contracts in `lib/*-types.ts`.
- Do not add barrel `index.ts` modules. Keep route handlers thin and direct.
- Use the shared party registry described in milestone 0.1; never create a second
  mapping of canonical party IDs, names, colors, or factions.
- All political presentation must distinguish source facts from derived labels.

## Milestone 0 — shared foundations

Do this narrowly as the first implementation commit, without adding empty pages
or navigation entries.

### 0.1 Canonical political identities

- [x] Extract stable party IDs, names, abbreviations, and colors into
      `lib/party-registry.ts`.
- [x] Keep dated political state such as current-government membership in
      `lib/political-context.ts`; faction membership comes from the Riigikogu
      source and must be resolved for the relevant date.
- [x] Make ratings normalization, projections, future Riigikogu data, watchlists,
      and financing use the same IDs.
- [x] Keep source-specific aliases in the relevant Norstat, Riigikogu, and ERJK
      adapters; add tests for aliases, unknown parties, historical names, and
      collision rejection.

Do not encode editorial categories such as `good`, `extreme`, or `establishment`.
Time-sensitive facts such as current government membership must include an
`effectiveFrom` date and be updated deliberately; do not mix them into the static
identity registry.

### 0.2 Navigation model

- [x] Move primary navigation definitions into
      `features/shell/model/navigation.ts` before adding a fourth destination.
- [x] Add a reusable `features/politics/client/politics-nav.tsx` only when
      `/riigikogu` ships.
- [x] Keep mobile destinations in a dedicated horizontally scrollable row so
      additional links cannot compress the logo, status, clock, or theme control.

### 0.3 Shared source metadata

- [x] Add a small reusable source-status contract only if current contracts cannot
      express `ok`, `stale`, `partial`, and `failed` consistently.
- [x] Reuse `lib/snapshot-cache.ts` and `lib/bounded-response.ts`; do not create
      per-feature copies.
- [x] Add fixture conventions: small hand-written valid, missing-field, schema-
      drift, and stale fixtures; never commit full upstream payloads.

Commit target: `refactor: add shared identities for political data`.

## Milestone 1 — Majandus

### User outcome

One page answers whether the Estonian economy and household purchasing power are
improving or deteriorating, while still allowing inspection of the actual series.

### 1.1 Source spike and series registry

Before UI work, freeze an explicit registry of table/series IDs and definitions.
Do not scatter Statistics Estonia table codes through components.

Create:

- `lib/economy-types.ts` — normalized API contract;
- `features/economy/server/economy-series.ts` — approved series registry;
- `features/economy/server/statistics-estonia.server.ts` — PxWeb adapter;
- later focused adapters for Eesti Pank, EMTA, and the Ministry of Finance;
- `features/economy/model/` — transformations and comparisons.

The first source commit must prove, with fixtures and live manual verification,
that each selected series has stable geography, unit, frequency, price basis,
seasonal-adjustment status, and update metadata.

Official sources:

- Statistics Estonia PxWeb API and manual:
  <https://andmed.stat.ee/api/v1/et> and
  <https://andmed.stat.ee/help/api-manual.pdf>
- Eesti Pank source/attribution policy and statistics portal:
  <https://www.eestipank.ee/statistika> and <https://statistika.eestipank.ee/>
- Ministry of Finance statistics:
  <https://www.fin.ee/ministeerium-uudised-ja-kontakt/uuringud-ja-analuusid/statistika>
- EMTA statistics and open data:
  <https://www.emta.ee/eraklient/amet-uudised-ja-kontakt/uudised-pressiinfo-statistika/statistika-ja-avaandmed>

### 1.2 MVP indicators

Ship the page first with a trustworthy core rather than every proposed number.

| Group | Initial indicators | Frequency | Comparison |
| --- | --- | --- | --- |
| Prices | CPI total; food; housing; transport | Monthly | previous month and year over year |
| Income | average gross wage; median gross wage; official real-wage measure when available | Quarterly | previous quarter and year over year |
| Work | unemployment rate; employment rate | Quarterly/monthly only when definitions match | previous period and year over year |
| Output | real GDP growth; GDP per capita or productivity when definitions are verified | Quarterly | quarter and year over year |
| Trade | exports, imports, trade balance | Monthly | previous month and year over year |
| Region | Võrumaa wage/employment indicators where the same official table supports them | Source cadence | Võrumaa vs Estonia, same period only |

Add interest rates, housing affordability, consumer confidence, tax receipts,
state revenue/spending, deficit, and debt only in milestone 1.4 after their
definitions and release behavior are locked.

### 1.3 API and UI

- [x] Add `app/api/economy/route.ts` as a thin handler and focused orchestration in
      `features/economy/server/economy-route.server.ts`.
- [x] Return grouped normalized series plus per-source status. Never return raw
      PxWeb responses.
- [x] Load independent sources with `Promise.allSettled`; one failed provider must
      yield `partial`, not erase successful groups.
- [x] Cache by source cadence: monthly/quarterly releases do not need five-minute
      polling. Revalidate in hours, retain last-known-good, and expose release age.
- [x] Respect PxWeb cell limits and `429 Retry-After`; query only approved
      dimensions and the bounded history needed by the UI.
- [x] Add `app/majandus/page.tsx`, `components/economy-portal.tsx`, and focused
      modules under `features/economy/client/`.
- [x] Lead with `Eesti majandus võrreldes aastatagusega`: counts of improved,
      worsened, and neutral indicators. The classification rules must be defined
      per indicator because lower inflation and lower unemployment differ from
      lower wages or GDP.
- [x] Each card shows current value, previous-period change, year-over-year change,
      release date, unit, compact history, and direct official source link.
- [x] Add category/detail views without loading all database dimensions.
- [ ] Add an official release calendar only when a stable official publication
      schedule or next-release field is available. Never guess dates.

### 1.4 Expansion

- [ ] Eesti Pank loan and deposit interest rates.
- [ ] A clearly defined housing-affordability ratio using compatible periods.
- [ ] Monthly tax receipts from EMTA.
- [ ] State revenue/spending, deficit, and debt from official finance/statistics
      sources.
- [ ] Consumer confidence only after licensing and machine-readable access are
      confirmed.

### Majandus acceptance criteria

- [x] Every number has one unambiguous unit, geography, period, source, and update
      time.
- [x] Statistics Estonia attribution and CC BY-SA 4.0 terms are visible wherever
      its data are presented or exported; other adapters preserve their official
      attribution/licence requirements.
- [x] Revisions replace previous releases safely and are marked when detectable.
- [x] Missing county data shows `not available`; it is never estimated from the
      national series.
- [x] Tests cover PxWeb dimension reordering, missing periods, revised values,
      unit mismatch, annual/monthly/quarterly comparisons, and direction labels.
- [x] Source failure leaves unaffected groups visible with a clear degraded state.

Suggested deployable commits:

1. `feat(economy): add official core data contract and adapters`
2. `feat(economy): add Majandus dashboard`
3. `feat(economy): add finance and regional indicators`

## Milestone 2 — Riigikogu Live

### User outcome

Connect projected political power to what the current Parliament is actually
discussing and voting on.

Official source:

- Riigikogu open-data REST API:
  <https://api.riigikogu.ee/swagger-ui/index.html>
- Riigikogu open-data policy, limits, and licence:
  <https://www.riigikogu.ee/avaandmed/>

### 2.1 Contract and ingestion

Create:

- `lib/riigikogu-types.ts`;
- `features/riigikogu/server/riigikogu-source.server.ts`;
- focused parsers for agenda, votes, documents, members, and statistics;
- `features/riigikogu/model/` for faction matrices and derived comparisons;
- `app/api/riigikogu/route.ts` as a compact overview entry;
- lazy `app/api/riigikogu/votes/[id]/route.ts` and
  `app/api/riigikogu/bills/[id]/route.ts` detail entries.

- [x] Start with plenary agenda, latest votes, vote details, documents/bills,
      current members, and faction membership.
- [x] Serialize/constrain upstream requests per process, cache official fetches
      through the deployment data cache, and stay below one request per second
      per IP and 12 requests per minute per URL/path in a single process.
- [ ] Add a platform-shared lock before a horizontally scaled deployment that
      requires a strict cross-instance rate-limit guarantee.
- [x] Cache slow-changing members separately from agendas and votes.
- [x] Store official UUIDs as stable IDs and preserve source URLs.
- [x] Normalize vote choices without collapsing `absent`, `did not vote`, and
      `abstained` into one state.
- [x] Scope the MVP to the current XV Riigikogu; historical expansion must account
      for documented gaps in older data.
- [x] Resolve faction membership at the time of each vote rather than applying a
      member's current faction to history.
- [x] Keep overview payloads compact and fetch member matrices/bill history only
      when a detail view opens.

### 2.2 UI

- [x] Add `/riigikogu` with `Täna`, `Hääletused`, and `Eelnõud` views.
- [x] `Täna`: current/next agenda items and status.
- [x] `Hääletused`: result, totals, faction matrix, and individual member detail.
- [x] `Eelnõud`: official title, status, initiators, dates, and documents; avoid
      invented plain-language summaries in v1.
- [ ] Link related news through deterministic entity/topic matching. Never imply
      that a news article is an official explanation.
- [x] Derive a `faction deviation` only when the rule is visible and testable:
      compare a member's vote to the plurality of cast votes in that faction,
      exclude ties, and label it descriptive rather than rebellious/disloyal.
- [x] Add the shared politics sub-navigation and rename only the top-level label
      to `Poliitika`; preserve `/reitingud`.

### Riigikogu acceptance criteria

- [x] Latest official vote and agenda match the source during manual verification.
- [x] Riigikogu attribution and CC BY-SA 3.0 terms are visible and preserved for
      displayed, derived, or exported data.
- [x] Totals reconcile with individual choices; exceptional vote states remain
      distinct.
- [x] Member/faction changes do not rewrite historical votes.
- [x] Empty parliamentary days have a useful no-session state, not an error.
- [x] Parser fixtures cover unknown vote choices, missing members, faction changes,
      pagination, and upstream rate-limit/failure responses.

Suggested deployable commits:

1. `feat(riigikogu): add official agenda and voting API`
2. `feat(riigikogu): add parliamentary dashboard`
3. `feat(politics): connect ratings and Riigikogu navigation`

## Milestone 3 — `/praegu`

### User outcome

A small personal briefing that shows only meaningful current state and changes,
not another full dashboard.

Initial cards:

1. biggest developing news, with existing local read state applied in the client;
2. Võru observation plus any active official warning;
3. latest polling movement and whether the current-government projection crossed
   51; saved coalition tracking is added in milestone 4;
4. latest meaningful Riigikogu vote or bill event;
5. most recently released economic indicator;
6. next verified economic/parliamentary release or agenda event, when available.

### 3.1 Aggregation

- [x] Add `lib/now-types.ts`, `features/now/model/`, and a thin
      `app/api/now/route.ts`.
- [x] First expose or extract cache-aware typed summary functions from the news,
      weather, ratings, economy, and Riigikogu server modules; do not assume these
      reusable boundaries already exist.
- [x] Compose those summary functions directly. Do not make server-to-self HTTP
      requests and do not send full news/weather histories to the overview.
- [x] Add a validated, independently cached official weather-warning adapter from
      <https://www.ilmateenistus.ee/ilma_andmed/xml/hoiatus.php> before promising a
      Võrumaa warning card; also expose the warning in the detailed weather desk.
- [x] Return a small card contract with stable event ID, priority, happenedAt,
      source area, headline, factual detail, target URL, source URL, and status.
- [x] Include a revision ID/fingerprint so a corrected release updates an existing
      event rather than appearing as a duplicate.
- [x] Preserve independent failures so one unavailable source removes only its
      card.
- [x] Use deterministic priority rules. No generative ranking or prose in v1.
- [x] Keep server output non-personal. Apply unread state, seen markers, and later
      watchlist preferences only in the browser.

### 3.2 Since-last-visit state

- [x] Store versioned per-stream markers in `117-now-seen-v1`, not a single global
      timestamp: latest news key/time, ratings wave ID, vote UUID, economy release
      ID, and warning ID.
- [x] Mark `new since last visit` only after comparing stable IDs/periods.
- [x] Update markers after the overview renders successfully, not before data
      arrives.
- [x] Provide a visible `Märgi kõik nähtuks` action and a local reset.

### `/praegu` acceptance criteria

- [x] Page remains useful with any one upstream area unavailable.
- [x] Unchanged data is visually quiet and new data is explainable.
- [x] Cards deep-link to the detailed local page and official source.
- [x] Payload stays compact and does not duplicate complete API responses.
- [x] Tests cover first visit, repeat visit, out-of-order timestamps, revised
      releases with the same period, and corrupted/migrated local state.

Suggested deployable commits:

1. `feat(now): add cross-feature summary contract`
2. `feat(now): add personal Praegu overview`

## Milestone 4 — local personal watchlists

### User outcome

Let the browser remember specific interests and elevate matching changes without
requiring an account or transmitting preference data.

### 4.1 Model and storage

- [x] Add watchlist types, storage validation, migrations, and event evaluation
      under `features/watchlist/model/`; this is a client-only model, not a public
      API contract.
- [x] Use a versioned `117-watchlists-v1` localStorage document with validation,
      migrations, deduplication, and a bounded number of entries.
- [x] Keep preferences entirely client-side in v1.
- [x] Synchronize changes across same-origin tabs through the browser `storage`
      event.
- [x] Add JSON export/import and `clear all` so the personal setup is portable and
      recoverable.
- [x] Explain that localStorage is not encrypted and is visible to anyone using
      the same browser profile. Never put watch terms in URLs, analytics, server
      logs, or referrers.

Supported watch types:

- news query/topic/source;
- party rating, 5% threshold crossing, and saved coalition majority state;
- Riigikogu member, faction, bill, or topic;
- economy indicator and new official release;
- official Võrumaa weather warning.
- ERJK party, uniquely identified published donor name, or financing topic.

Do not add arbitrary numeric automation, background push, or financial trading
alerts in v1.

### 4.2 Integration

- [x] Add consistent `Jälgi`/`Jälgimisel` controls to detailed source pages.
- [x] Evaluate matches with pure client models against normalized data; do not
      upload the watchlist to APIs.
- [x] Add a watched-only filter where it helps, plus a `Jälgitavad` group on
      `/praegu`.
- [x] Use text/icon/ARIA state as well as color; all controls must be keyboard
      usable.
- [x] Distinguish `new match` from `still matches` to avoid permanent alert noise.

### Watchlist acceptance criteria

- [x] The feature works without cookies, login, database, or server preference
      storage.
- [x] Invalid imports fail safely and do not overwrite valid preferences.
- [x] Renamed parties and updated member data retain watches through canonical IDs.
- [x] Storage is bounded and old seen-event markers are pruned.
- [x] Tests cover validation, migration, matching, threshold crossings, coalition
      changes, deduplication, import/export, and privacy boundaries.

Suggested deployable commits:

1. `feat(watchlists): add local watchlist model`
2. `feat(watchlists): integrate watched changes across dashboards`

## Milestone 5 — political financing

### User outcome

Show who funds parties and how reported political money changes over time, next to
polling and parliamentary activity, without implying causation or wrongdoing.

Official sources:

- ERJK open data: <https://www.erjk.ee/en/open-data>
- ERJK financing reports:
  <https://www.erjk.ee/en/financing-reports/revenue-reports>

ERJK attribution and the published open-data licence must be shown on the page and
in exported/reused data.

### 5.1 Contract and ingestion

- [x] Add `lib/political-finance-types.ts` and focused ERJK adapters under
      `features/political-finance/server/`.
- [x] Keep `/api/political-finance` compact and expose a separately paginated,
      capped `/api/political-finance/records` detail endpoint.
- [x] Normalize filings, report periods, parties, donation/income categories,
      expenses, donors when legally published, and corrections.
- [x] Use the shared party registry. Preserve original reported names alongside
      canonical IDs.
- [x] Cache according to quarterly/campaign reporting cadence; show report period
      and publication/retrieval dates prominently.
- [x] Treat corrected filings as revisions, not duplicate new transactions.
- [x] Store and display only ERJK's officially public donor fields; do not enrich
      identities or retain unnecessary raw personal data.

### 5.2 UI

- [x] Add `/erakonnaraha` and the third politics sub-navigation item `Raha`.
- [x] Show latest filed period, party income and spending, donation composition,
      largest published donations/donors, donor concentration, and history.
- [x] Provide party, period, record-type, and category filters for quarterly
      reports.
- [ ] Add election/campaign filters after those filing types are normalized.
- [ ] Allow a polling timeline overlay only as an optional visual comparison with
      an explicit `correlation does not establish cause` note.
- [x] Link every aggregate to its underlying official report/source where possible.
- [x] Integrate party, unambiguous published-donor-name, and topic watches after
      the standalone page is trustworthy; duplicate public names are deliberately
      not individually watchable.

### Political-finance acceptance criteria

- [x] Aggregates reconcile with included normalized rows and official totals within
      documented rounding/correction rules.
- [x] Legal entities, natural persons, party self-financing, and other income are
      not silently combined.
- [x] Corrections and late filings update history deterministically.
- [x] UI never labels a donation suspicious, influential, or causal without an
      external attributed factual source.
- [x] Fixtures cover corrected filings, duplicate names, missing registry matches,
      report-period boundaries, and unknown categories.

Suggested deployable commits:

1. `feat(political-finance): add ERJK normalized API`
2. `feat(political-finance): add party financing dashboard`
3. `feat(watchlists): add political-money watches`

## Cross-feature definition of done

Every deployable milestone must:

- update `docs/ai-data-contracts.md`, `AGENTS.md`, and current-behavior sections
  of `README.md` only for code that actually shipped;
- include pure model tests, parser/adapter fixture tests, error/freshness tests,
  and route-policy tests proportional to risk;
- add focused scripts such as `test:economy`, `test:riigikogu`, `test:praegu`, and
  `test:political-finance` as their test suites land;
- run the affected feature suite, `npm test`, `npm run typecheck`,
  `npm run check:context`, and `npm run build`;
- verify a fresh production build visually at desktop and mobile widths for all
  changed routes;
- confirm the generated production CSS contains utilities used by any new source
  root;
- keep unrelated pages functional under upstream failure;
- leave no empty navigation destination or placeholder production page;
- land as a focused commit with a clean worktree before starting the next item.

## Resume instructions for a future coding session

1. Read `AGENTS.md`, then this roadmap.
2. Check the boxes and git history to identify the first unfinished milestone.
3. Verify only the official sources needed for that milestone because APIs and
   datasets can change.
4. Implement only that milestone's deployable slice; do not preload or refactor
   later feature trees.
5. Preserve all explicit out-of-scope decisions above.
6. After verification, update this checklist and commit the completed slice.
