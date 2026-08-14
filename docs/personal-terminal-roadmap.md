# 117.ee political tools scope

Status: Riigikogu Live and political financing are implemented. The broader
Praegu, Majandus, local-watchlist, and weather-warning experiment was removed on
request and is not part of the current product scope.

## Current information architecture

Preserve the existing news and weather tools and the three political views:

| Area | Route | Purpose |
| --- | --- | --- |
| News | `/` | Existing Estonian news desk |
| Weather | `/ilm` | Existing advanced Võru weather desk |
| Ratings | `/reitingud` | Polling and 101-seat projection |
| Parliament | `/riigikogu` | Official agenda, votes, bills, and factions |
| Political money | `/erakonnaraha` | ERJK quarterly financing reports |

Primary navigation is `Uudised · Ilm · Poliitika`. The shared politics
sub-navigation is `Reitingud · Riigikogu · Raha`.

Do not reintroduce `/praegu`, `/majandus`, local watchlists, or the separate
weather-warning panel unless the user explicitly changes this scope.

## Shared implementation rules

- External data is fetched only by server modules and exposed through internal
  App Router APIs.
- Validate upstream schemas and identifiers before data reaches client code.
- Preserve source name and URL, licence, official record IDs, publication and
  retrieval times, and stale/partial state.
- Keep bounded bodies, explicit timeouts, approved hosts, cache policies, and
  safe public errors.
- One failed source must not erase independent useful data.
- Use `Europe/Tallinn` for display and UTC ISO strings in contracts.
- Keep source parsing in `features/<feature>/server/`, pure calculations in
  `features/<feature>/model/`, client state in `features/<feature>/client/`, and
  public contracts in `lib/*-types.ts`.
- Political presentation must distinguish official facts from 117.ee derived
  labels. Never infer wrongdoing, influence, or loyalty.
- Canonical party presentation lives in `lib/party-registry.ts`; source aliases
  remain in the Riigikogu and ERJK adapters.

## Riigikogu Live

Implemented files:

- `app/api/riigikogu/route.ts`
- `app/api/riigikogu/votes/[id]/route.ts`
- `app/api/riigikogu/bills/[id]/route.ts`
- `app/riigikogu/page.tsx`
- `features/riigikogu/`
- `lib/riigikogu-types.ts`

Required behavior:

- Discover the current Riigikogu membership from the official API and use it
  consistently for active bills, members, and presentation labels.
- Keep agenda, latest votes, active bills, and faction composition independently
  recoverable and explicitly stale/partial when appropriate.
- Refresh on a five-minute interval and when the page becomes active, retaining
  last usable data if a refresh fails.
- Show only the Tallinn-calendar-day sitting under `Täna`; label a later sitting
  as the next sitting rather than today.
- Load vote and bill details only when opened.
- Preserve `poolt`, `vastu`, `erapooletu`, `ei hääletanud`, `puudus`, and unknown
  states separately.
- Label faction-majority comparisons as descriptive calculations, not official
  party positions or loyalty judgments.
- Respect the official upstream limits through the centralized scheduler and
  deployment cache. A horizontally scaled deployment still needs a shared lock
  for a strict cross-instance guarantee.
- Display Riigikogu attribution and CC BY-SA 3.0 terms.

Validate with `npm run test:riigikogu`.

## Political financing

Implemented files:

- `app/api/political-finance/route.ts`
- `app/api/political-finance/records/route.ts`
- `app/erakonnaraha/page.tsx`
- `features/political-finance/`
- `lib/political-finance-types.ts`

Required behavior:

- Use only ERJK's official public API and public fields.
- Keep quarterly period, reporting entity, official report ID and URL, filing
  revision, income/expense category, and source timestamps explicit.
- Treat corrections as revisions of the same filing rather than duplicate
  reports.
- Never coerce a failed income or expense aggregate to factual zero.
- Drop birth dates and private source identity keys from normalized output.
- Same published donor names may remain separate but must be marked ambiguous;
  do not imply that identical names identify one person.
- Keep records filters and page sizes allowlisted and bounded.
- Describe rankings and concentrations neutrally. Donations or spending are not
  evidence of influence or wrongdoing.
- Display ERJK attribution and CC BY-SA 3.0 terms.

Validate with `npm run test:political-finance`.

## Release gate

Before shipping changes to either retained feature:

1. Run its focused suite.
2. Run `npm test` and `npm run typecheck`.
3. Run `npm run check:context` and `npm run build`.
4. Verify `/reitingud`, `/riigikogu`, and `/erakonnaraha` at desktop and mobile
   widths, including one lazy detail flow.
5. Confirm failures remain explicit and official attribution remains visible.
