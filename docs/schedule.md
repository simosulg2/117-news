# Private schedule operations

`/ajakava` is a private 117.ee section backed by an encrypted, versioned
schedule payload. The workbook and normalized plaintext must stay outside Git.
Only the AES-GCM ciphertext in `data/schedule.enc.json` is committed.

## Authentication setup

Create a GitHub OAuth app with these callback URLs:

- Local: `http://localhost:3000/api/auth/callback/github`
- Production: `https://117.ee/api/auth/callback/github`

Configure these runtime-only values:

- `AUTH_SECRET`: independent random secret for Auth.js.
- `AUTH_GITHUB_ID`: GitHub OAuth client ID.
- `AUTH_GITHUB_SECRET`: GitHub OAuth client secret.
- `AUTH_TRUST_HOST=true`: trust the HTTPS host forwarded by Coolify.
- `SCHEDULE_ALLOWED_GITHUB_ID`: immutable numeric ID of the one allowed GitHub
  account. The public GitHub user API returns it as `id`; do not use a mutable
  username or email address.
- `SCHEDULE_DATA_KEY`: base64url-encoded 32-byte key for the encrypted schedule.

The local `.env.local` created with the initial payload contains the current
`AUTH_SECRET` and `SCHEDULE_DATA_KEY`. Copy those two values into Coolify, fill
in the GitHub values, and do not set `SCHEDULE_DEV_BYPASS` in production.

The sign-in flow accepts only GitHub, fixes the post-login destination to
`/ajakava`, and rechecks the current allowlist at the server data boundary.
Authentication tokens are never stored in browser storage or returned in the
schedule page model.

## Re-encrypting schedule data

Prepare a private JSON file matching `lib/schedule-types.ts`, then run:

```powershell
$env:SCHEDULE_DATA_KEY = "<the existing base64url key>"
npm run schedule:encrypt -- "C:\private\schedule.json"
Remove-Item Env:SCHEDULE_DATA_KEY
```

When normalizing the workbook, use exact windows from the school, routine, and
study sheets—and exact times embedded in master cells—as the authority. The
master sheet's broader row window is only a layout bucket when those differ.

The command replaces `data/schedule.enc.json` with authenticated AES-256-GCM
ciphertext. Inspect and validate the private JSON before encrypting it. Never
commit the source workbook, normalized JSON, `.env.local`, or a key.

Changing `SCHEDULE_DATA_KEY` requires re-encrypting the payload. Changing
`AUTH_SECRET` invalidates existing sessions. Removing or changing
`SCHEDULE_ALLOWED_GITHUB_ID` revokes schedule access on the next authorization
check.

## Failure and cache behavior

- Missing auth configuration fails closed at `/sisene`.
- Missing or incorrect schedule encryption configuration is shown only after
  successful authentication and never includes underlying error details.
- Private schedule pages are dynamic, non-indexable, and use `no-store` cache
  semantics.
- The public news, weather, ratings, parliament, and financing sections remain
  available when schedule authentication is unconfigured.

Validate with `npm run test:schedule`, followed by the full project release
gate in `AGENTS.md`.
