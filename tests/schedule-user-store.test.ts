import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeScheduleSignIn,
  hashScheduleInviteToken,
  normalizeScheduleUserId,
} from "../features/auth/server/schedule-user-store.server.ts";

const USER_ID = "4a6ab1fd-5f1a-4ad8-ae57-77b20fcbd63f";
const INVITE_TOKEN = "ajakava_0123456789abcdefghijklmnopqrstuv";

test("normalizes only opaque schedule user UUIDs", () => {
  assert.equal(normalizeScheduleUserId(USER_ID), USER_ID);
  assert.equal(
    normalizeScheduleUserId(`  ${USER_ID.toUpperCase()}  `),
    USER_ID,
  );
  assert.equal(normalizeScheduleUserId("12345678"), null);
  assert.equal(normalizeScheduleUserId("github-login-name"), null);
  assert.equal(normalizeScheduleUserId("00000000-0000-0000-0000-000000000000"), null);
  assert.equal(normalizeScheduleUserId(undefined), null);
});

test("hashes only bounded invite tokens and never returns the token itself", () => {
  const hash = hashScheduleInviteToken(INVITE_TOKEN);

  assert.match(hash ?? "", /^[0-9a-f]{64}$/u);
  assert.equal(hash, hashScheduleInviteToken(INVITE_TOKEN));
  assert.equal(hash, hashScheduleInviteToken(`  ${INVITE_TOKEN}  `));
  assert.notEqual(hash, INVITE_TOKEN);
  assert.equal(hashScheduleInviteToken(""), null);
  assert.equal(hashScheduleInviteToken("ajakava_too-short"), null);
  assert.equal(hashScheduleInviteToken(`ajakava_${"A".repeat(33)}`), null);
  assert.equal(hashScheduleInviteToken(`other_${"A".repeat(32)}`), null);
});

test("claims an invitation atomically without sending its bearer token to PostgreSQL", async () => {
  const providerAccountId = "87654321";
  const inviteId = "a1246d8e-e557-4607-af50-33b890de37f9";
  const memberId = "ee77c07a-e333-4672-8b27-fc6ef7d63ef9";
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.includes("FROM schedule_users") && text.includes("provider_account_id")) {
        return { rows: [] };
      }
      if (text.includes("FROM schedule_invites") && text.includes("FOR UPDATE")) {
        return { rows: [{ id: inviteId }] };
      }
      if (text.includes("INSERT INTO schedule_users")) {
        return { rows: [{ id: memberId, role: "member" }] };
      }
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return { rows: [] };
    },
    async connect() {
      return client;
    },
    on() {},
  };
  const shared = globalThis as typeof globalThis & { __schedulePool117?: unknown };
  const previousPool = shared.__schedulePool117;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDataKey = process.env.SCHEDULE_DATA_KEY;
  process.env.DATABASE_URL = "postgresql://schedule:secret@database/schedule";
  process.env.SCHEDULE_DATA_KEY = "A".repeat(43);
  shared.__schedulePool117 = pool;

  try {
    assert.deepEqual(
      await authorizeScheduleSignIn(providerAccountId, INVITE_TOKEN),
      { id: memberId, isAdmin: false },
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousDataKey === undefined) delete process.env.SCHEDULE_DATA_KEY;
    else process.env.SCHEDULE_DATA_KEY = previousDataKey;
    if (previousPool === undefined) delete shared.__schedulePool117;
    else shared.__schedulePool117 = previousPool;
  }

  const transactionStatements = calls
    .map(({ text }) => text.trim())
    .filter((text) => ["BEGIN", "COMMIT", "ROLLBACK"].includes(text));
  const inviteLookup = calls.find(({ text }) => text.includes("FROM schedule_invites"));
  const memberInsert = calls.find(({ text }) => text.includes("INSERT INTO schedule_users"));
  const claimUpdate = calls.find(({ text }) => text.includes("UPDATE schedule_invites"));

  assert.deepEqual(transactionStatements, ["BEGIN", "COMMIT"]);
  assert.match(inviteLookup?.text ?? "", /claimed_at IS NULL/u);
  assert.match(inviteLookup?.text ?? "", /revoked_at IS NULL/u);
  assert.match(inviteLookup?.text ?? "", /expires_at > NOW\(\)/u);
  assert.match(inviteLookup?.text ?? "", /creator\.role = 'owner'/u);
  assert.match(inviteLookup?.text ?? "", /creator\.disabled_at IS NULL/u);
  assert.match(inviteLookup?.text ?? "", /FOR UPDATE/u);
  assert.deepEqual(inviteLookup?.values, [hashScheduleInviteToken(INVITE_TOKEN)]);
  assert.match(memberInsert?.text ?? "", /'member'/u);
  assert.deepEqual(memberInsert?.values?.[1], providerAccountId);
  assert.match(claimUpdate?.text ?? "", /claimed_by_user_id = \$2/u);
  assert.deepEqual(claimUpdate?.values, [inviteId, memberId]);
  assert.equal(
    calls.some(({ values }) => values?.some((value) => value === INVITE_TOKEN)),
    false,
  );
});

test("rolls back an invitation claim when member creation fails", async () => {
  const calls: string[] = [];
  const client = {
    async query(text: string) {
      calls.push(text.trim());
      if (text.includes("FROM schedule_users") && text.includes("provider_account_id")) {
        return { rows: [] };
      }
      if (text.includes("FROM schedule_invites") && text.includes("FOR UPDATE")) {
        return { rows: [{ id: "a1246d8e-e557-4607-af50-33b890de37f9" }] };
      }
      if (text.includes("INSERT INTO schedule_users")) {
        throw new Error("simulated insert failure");
      }
      return { rows: [] };
    },
    release() {},
  };
  const shared = globalThis as typeof globalThis & { __schedulePool117?: unknown };
  const previousPool = shared.__schedulePool117;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDataKey = process.env.SCHEDULE_DATA_KEY;
  process.env.DATABASE_URL = "postgresql://schedule:secret@database/schedule";
  process.env.SCHEDULE_DATA_KEY = "A".repeat(43);
  shared.__schedulePool117 = {
    async query() { return { rows: [] }; },
    async connect() { return client; },
    on() {},
  };

  try {
    await assert.rejects(
      authorizeScheduleSignIn("87654321", INVITE_TOKEN),
      /simulated insert failure/u,
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousDataKey === undefined) delete process.env.SCHEDULE_DATA_KEY;
    else process.env.SCHEDULE_DATA_KEY = previousDataKey;
    if (previousPool === undefined) delete shared.__schedulePool117;
    else shared.__schedulePool117 = previousPool;
  }

  assert.ok(calls.includes("BEGIN"));
  assert.ok(calls.includes("ROLLBACK"));
  assert.equal(calls.includes("COMMIT"), false);
  assert.equal(calls.some((text) => text.includes("UPDATE schedule_invites")), false);
});
