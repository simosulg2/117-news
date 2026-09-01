export const SCHEDULE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS schedule_users (
    id UUID PRIMARY KEY,
    auth_provider TEXT NOT NULL CHECK (auth_provider = 'github'),
    provider_account_id TEXT NOT NULL CHECK (provider_account_id ~ '^[1-9][0-9]{0,19}$'),
    role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disabled_at TIMESTAMPTZ,
    UNIQUE (auth_provider, provider_account_id)
  );

  CREATE TABLE IF NOT EXISTS schedule_invites (
    id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    created_by_user_id UUID NOT NULL REFERENCES schedule_users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    claimed_by_user_id UUID REFERENCES schedule_users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    CHECK (expires_at > created_at)
  );

  CREATE INDEX IF NOT EXISTS schedule_invites_created_by_idx
    ON schedule_invites (created_by_user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS schedule_documents (
    user_id UUID PRIMARY KEY REFERENCES schedule_users(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
    encrypted_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;
