# Private schedule operations

`/ajakava` is a private, invite-only 117.ee section. Each account owns an
independent, versioned schedule document in PostgreSQL. Documents are encrypted
in the application with a key derived uniquely for their opaque internal user
ID. The workbook and normalized plaintext must stay outside Git. The committed
AES-GCM ciphertext in `data/schedule.enc.json` is only the new-account template.

## Authentication setup

Create a GitHub OAuth app with these callback URLs:

- Local: `http://localhost:3000/api/auth/callback/github`
- Production: `https://117.ee/api/auth/callback/github`

Configure these runtime-only values:

- `AUTH_SECRET`: independent random secret for Auth.js.
- `AUTH_GITHUB_ID`: GitHub OAuth client ID.
- `AUTH_GITHUB_SECRET`: GitHub OAuth client secret.
- `AUTH_TRUST_HOST=true`: trust the HTTPS host forwarded by Coolify.
- `AUTH_URL=https://117.ee`: force Auth.js to use the public production origin
  instead of Coolify's internal `localhost:3000` origin after OAuth returns.
- `SCHEDULE_ALLOWED_GITHUB_ID`: immutable numeric ID of the bootstrap owner.
  The public GitHub user API returns it as `id`; do not use a mutable username
  or email address. After the first successful sign-in, membership is stored in
  PostgreSQL and this value remains the safe bootstrap path for the owner.
- `SCHEDULE_DATA_KEY`: base64url-encoded 32-byte master key for the encrypted
  template and the per-user derived data keys.
- `DATABASE_URL`: the same PostgreSQL connection already used by 117.ee.

The local `.env.local` created with the initial payload contains the current
`AUTH_SECRET` and `SCHEDULE_DATA_KEY`. Copy those two values into Coolify, fill
in the GitHub values, set the production `AUTH_URL`, and do not set
`SCHEDULE_DEV_BYPASS` in production.

The sign-in flow accepts only GitHub, fixes the post-login destination to
`/ajakava`, and rechecks active membership at the server data boundary. The
GitHub provider ID is used only by the server-side account mapping. Only an
opaque internal user ID is carried in the authenticated session; authentication
and invitation tokens are never placed in browser storage or schedule data.
The sign-in form defaults to an eight-hour session. Its optional
`Jää sisselogituks` choice uses a rolling 30-day idle lifetime. Explicit
sign-out, disabling the stored account, or rotating `AUTH_SECRET` still removes
access without introducing a permanent bearer credential. The OAuth round trip
carries this choice only in a short-lived HttpOnly cookie.

## Accounts and invitations

The bootstrap owner can create and revoke single-use invitations in the account
controls. Send the generated link through a private channel. Its bearer value
stays in the browser-only URL fragment, is removed from the address bar after
the page loads, and is posted directly to the server. A short-lived HttpOnly
cookie then carries it through the OAuth round trip and the server consumes it
transactionally. An invitation
expires after seven days, can be revoked before use, and never appears in the
database in bearer form—only its SHA-256 hash is stored.

On an invited account's first `/ajakava` request, the server decrypts and
validates the full committed class, routine, and weekly template. It then
re-encrypts an independent copy with that user's derived key and persists it;
new users do not begin with a blank document. Later edits remain private to
that account and do not modify the shared template or another user's copy.
Every read and compare-and-swap update is scoped to the authenticated internal
user ID. A stale revision is rejected so two tabs cannot silently overwrite
one another.

The timetable and routine lists are the single sources for their recurring
items. `Täna` and `Nädal` derive those entries automatically, so a lesson or
routine is edited only once. Legacy duplicate event rows are ignored in the
editor and timeline but retained in the encrypted source document. Their IDs
are recorded once in encrypted editor metadata, so later routine changes cannot
make stale rows reappear and the compatibility migration remains non-destructive.

The application creates `schedule_users`, `schedule_invites`, and
`schedule_documents` with `CREATE TABLE IF NOT EXISTS`; no additional Coolify
service or per-user environment variable is needed.

## Re-encrypting schedule data

Prepare a private JSON file matching `lib/schedule-types.ts`, then run:

```powershell
$env:SCHEDULE_DATA_KEY = "<the existing base64url key>"
npm run schedule:encrypt -- "C:\private\schedule.json"
Remove-Item Env:SCHEDULE_DATA_KEY
```

When normalizing the workbook, use exact windows from the school and routine
sheets—and exact times embedded in master cells—as the authority. The master
sheet's broader row window is only a layout bucket when those differ. Keep all
user-facing schedule copy in Estonian and treat the dedicated study-plan view
as intentionally disabled.

The command replaces `data/schedule.enc.json` with authenticated AES-256-GCM
ciphertext. Inspect and validate the private JSON before encrypting it. Never
commit the source workbook, normalized JSON, `.env.local`, or a key.

Do not rotate `SCHEDULE_DATA_KEY` without a database re-encryption migration:
it protects both the template and all persisted user documents. Changing
`AUTH_SECRET` invalidates existing sessions. Changing
`SCHEDULE_ALLOWED_GITHUB_ID` changes only which account can be bootstrapped as
an owner; it does not silently revoke accounts already stored in PostgreSQL.

## Failure and cache behavior

- Missing auth, database, or encryption configuration fails closed at
  `/sisene`.
- Missing or incorrect schedule encryption configuration is shown only after
  successful authentication and never includes underlying error details.
- Private schedule pages are dynamic, non-indexable, and use `no-store` cache
  semantics.
- `SCHEDULE_DEV_BYPASS=1` works only in development. It uses a process-local
  editable copy of the encrypted template and never creates a production user
  or weakens production authorization.
- The public news, weather, ratings, parliament, and financing sections remain
  available when schedule authentication is unconfigured.

Validate with `npm run test:schedule`, followed by the full project release
gate in `AGENTS.md`.
