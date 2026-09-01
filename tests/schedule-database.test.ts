import assert from "node:assert/strict";
import test from "node:test";

import { schedulePoolConfig } from "../features/auth/server/schedule-database.server.ts";
import { SCHEDULE_SCHEMA_SQL } from "../features/auth/server/schedule-schema.server.ts";

test("bounds private schedule database connections and queries", () => {
  const config = schedulePoolConfig("postgresql://schedule:secret@database/schedule");

  assert.equal(config.connectionTimeoutMillis, 5_000);
  assert.equal(config.statement_timeout, 5_000);
  assert.equal(config.lock_timeout, 5_000);
  assert.equal(config.query_timeout, 5_000);
  assert.equal(config.idleTimeoutMillis, 30_000);
  assert.equal(config.max, 2);
});

test("schedule schema isolates users, documents, and single-use invitations", () => {
  for (const table of ["schedule_users", "schedule_invites", "schedule_documents"]) {
    assert.match(SCHEDULE_SCHEMA_SQL, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }

  assert.match(SCHEDULE_SCHEMA_SQL, /provider_account_id TEXT NOT NULL/);
  assert.match(SCHEDULE_SCHEMA_SQL, /UNIQUE \(auth_provider, provider_account_id\)/);
  assert.match(SCHEDULE_SCHEMA_SQL, /role IN \('owner', 'member'\)/);
  assert.match(SCHEDULE_SCHEMA_SQL, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(SCHEDULE_SCHEMA_SQL, /claimed_by_user_id UUID/);
  assert.match(SCHEDULE_SCHEMA_SQL, /revoked_at TIMESTAMPTZ/);
  assert.match(SCHEDULE_SCHEMA_SQL, /user_id UUID PRIMARY KEY/);
  assert.match(SCHEDULE_SCHEMA_SQL, /revision BIGINT NOT NULL DEFAULT 1 CHECK \(revision > 0\)/);
  assert.match(SCHEDULE_SCHEMA_SQL, /encrypted_payload JSONB NOT NULL/);
  assert.match(SCHEDULE_SCHEMA_SQL, /ON DELETE CASCADE/g);
  assert.doesNotMatch(SCHEDULE_SCHEMA_SQL, /CREATE EXTENSION/i);
});

test("schedule documents never add queryable plaintext schedule columns", () => {
  const documentsDefinition = SCHEDULE_SCHEMA_SQL.match(
    /CREATE TABLE IF NOT EXISTS schedule_documents \(([\s\S]*?)\n  \);/u,
  )?.[1];

  assert.ok(documentsDefinition);
  assert.doesNotMatch(
    documentsDefinition,
    /\b(?:title|subtitle|events|school_periods|routines|study_plans|metrics)\b/iu,
  );
});
