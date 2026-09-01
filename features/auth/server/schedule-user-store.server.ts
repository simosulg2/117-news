import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

import {
  ensureScheduleSchema,
  requireSchedulePool,
} from "./schedule-database.server.ts";
import { normalizeGithubAccountId } from "./schedule-auth-policy.ts";

const INVITE_PATTERN = /^ajakava_[A-Za-z0-9_-]{32}$/u;
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type ScheduleUserRow = {
  id: string;
  role: "owner" | "member";
};

export type ScheduleUserAccess = Readonly<{
  id: string;
  isAdmin: boolean;
}>;

export function normalizeScheduleUserId(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return USER_ID_PATTERN.test(normalized) ? normalized : null;
}

export function hashScheduleInviteToken(value: string): string | null {
  const token = value.trim();
  if (!INVITE_PATTERN.test(token)) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function access(row: ScheduleUserRow | undefined): ScheduleUserAccess | null {
  const id = normalizeScheduleUserId(row?.id);
  if (!id || (row?.role !== "owner" && row?.role !== "member")) return null;
  return { id, isAdmin: row.role === "owner" };
}

async function activeUserByProviderId(
  client: Pool | PoolClient,
  providerAccountId: string,
): Promise<ScheduleUserAccess | null> {
  const result = await client.query<ScheduleUserRow>(
    `SELECT id, role
       FROM schedule_users
      WHERE auth_provider = 'github'
        AND provider_account_id = $1
        AND disabled_at IS NULL
      LIMIT 1`,
    [providerAccountId],
  );
  return access(result.rows[0]);
}

export async function findScheduleUserByProviderAccountId(
  providerAccountIdValue: string | undefined,
): Promise<ScheduleUserAccess | null> {
  const providerAccountId = normalizeGithubAccountId(providerAccountIdValue);
  if (!providerAccountId) return null;
  const pool = requireSchedulePool();
  await ensureScheduleSchema(pool);
  return activeUserByProviderId(pool, providerAccountId);
}

export async function getScheduleUserAccessById(
  userIdValue: string | undefined,
): Promise<ScheduleUserAccess | null> {
  const userId = normalizeScheduleUserId(userIdValue);
  if (!userId) return null;
  const pool = requireSchedulePool();
  await ensureScheduleSchema(pool);
  const result = await pool.query<ScheduleUserRow>(
    `SELECT id, role
       FROM schedule_users
      WHERE id = $1
        AND disabled_at IS NULL
      LIMIT 1`,
    [userId],
  );
  return access(result.rows[0]);
}

async function bootstrapOwner(
  client: PoolClient,
  providerAccountId: string,
): Promise<ScheduleUserAccess> {
  const newUserId = randomUUID();
  const result = await client.query<ScheduleUserRow>(
    `INSERT INTO schedule_users (id, auth_provider, provider_account_id, role)
     VALUES ($1, 'github', $2, 'owner')
     ON CONFLICT (auth_provider, provider_account_id) DO UPDATE
       SET role = 'owner'
       WHERE schedule_users.disabled_at IS NULL
     RETURNING id, role`,
    [newUserId, providerAccountId],
  );
  const user = access(result.rows[0]);
  if (!user) throw new Error("Schedule owner bootstrap failed.");
  return user;
}

async function claimInvite(
  client: PoolClient,
  providerAccountId: string,
  inviteToken: string | undefined,
): Promise<ScheduleUserAccess | null> {
  const tokenHash = inviteToken ? hashScheduleInviteToken(inviteToken) : null;
  if (!tokenHash) return null;

  const invite = await client.query<{ id: string }>(
    `SELECT i.id
       FROM schedule_invites i
       JOIN schedule_users creator ON creator.id = i.created_by_user_id
      WHERE i.token_hash = $1
        AND i.claimed_at IS NULL
        AND i.revoked_at IS NULL
        AND i.expires_at > NOW()
        AND creator.role = 'owner'
        AND creator.disabled_at IS NULL
      FOR UPDATE`,
    [tokenHash],
  );
  if (!invite.rows[0]) return null;

  const newUserId = randomUUID();
  const inserted = await client.query<ScheduleUserRow>(
    `INSERT INTO schedule_users (id, auth_provider, provider_account_id, role)
     VALUES ($1, 'github', $2, 'member')
     RETURNING id, role`,
    [newUserId, providerAccountId],
  );
  const user = access(inserted.rows[0]);
  if (!user) throw new Error("Schedule invite claim failed.");

  await client.query(
    `UPDATE schedule_invites
        SET claimed_at = NOW(), claimed_by_user_id = $2
      WHERE id = $1`,
    [invite.rows[0].id, user.id],
  );
  return user;
}

/** Authorizes an existing account, bootstraps the configured owner, or atomically claims an invite. */
export async function authorizeScheduleSignIn(
  providerAccountIdValue: string | undefined,
  inviteToken?: string,
): Promise<ScheduleUserAccess | null> {
  const providerAccountId = normalizeGithubAccountId(providerAccountIdValue);
  if (!providerAccountId) return null;

  const pool = requireSchedulePool();
  await ensureScheduleSchema(pool);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await activeUserByProviderId(client, providerAccountId);
    if (existing) {
      await client.query("COMMIT");
      return existing;
    }

    const configuredOwner = normalizeGithubAccountId(
      process.env.SCHEDULE_ALLOWED_GITHUB_ID,
    );
    const user = providerAccountId === configuredOwner
      ? await bootstrapOwner(client, providerAccountId)
      : await claimInvite(client, providerAccountId, inviteToken);
    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
