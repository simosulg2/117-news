import { randomBytes, randomUUID } from "node:crypto";

import {
  ensureScheduleSchema,
  requireSchedulePool,
} from "./schedule-database.server.ts";
import {
  hashScheduleInviteToken,
  normalizeScheduleUserId,
} from "./schedule-user-store.server.ts";

const INVITE_PREFIX = "ajakava_";
const DEFAULT_INVITE_HOURS = 7 * 24;
const MAX_INVITE_HOURS = 30 * 24;

export type CreatedScheduleInvite = Readonly<{
  id: string;
  token: string;
  expiresAt: string;
}>;

export type ScheduleInviteSummary = Readonly<{
  id: string;
  createdAt: string;
  expiresAt: string;
  status: "available" | "claimed" | "expired" | "revoked";
}>;

export async function isScheduleInviteAvailable(token: string): Promise<boolean> {
  const tokenHash = hashScheduleInviteToken(token);
  if (!tokenHash) return false;
  const pool = requireSchedulePool();
  await ensureScheduleSchema(pool);
  const result = await pool.query(
    `SELECT 1
       FROM schedule_invites i
       JOIN schedule_users creator ON creator.id = i.created_by_user_id
      WHERE i.token_hash = $1
        AND i.claimed_at IS NULL
        AND i.revoked_at IS NULL
        AND i.expires_at > NOW()
        AND creator.role = 'owner'
        AND creator.disabled_at IS NULL
      LIMIT 1`,
    [tokenHash],
  );
  return result.rowCount === 1;
}

export async function createScheduleInvite(
  actorUserIdValue: string,
  validForHours: number = DEFAULT_INVITE_HOURS,
): Promise<CreatedScheduleInvite | null> {
  const actorUserId = normalizeScheduleUserId(actorUserIdValue);
  const boundedHours = Number.isInteger(validForHours)
    && validForHours >= 1
    && validForHours <= MAX_INVITE_HOURS
    ? validForHours
    : null;
  if (!actorUserId || !boundedHours) return null;

  const pool = requireSchedulePool();
  await ensureScheduleSchema(pool);
  const id = randomUUID();
  const token = `${INVITE_PREFIX}${randomBytes(24).toString("base64url")}`;
  const tokenHash = hashScheduleInviteToken(token);
  if (!tokenHash) throw new Error("Schedule invite generation failed.");
  const result = await pool.query<{ expires_at: Date | string }>(
    `INSERT INTO schedule_invites (
       id, token_hash, created_by_user_id, expires_at
     )
     SELECT $1, $2, id, NOW() + ($4 * INTERVAL '1 hour')
       FROM schedule_users
      WHERE id = $3 AND role = 'owner' AND disabled_at IS NULL
     RETURNING expires_at`,
    [id, tokenHash, actorUserId, boundedHours],
  );
  if (!result.rows[0]) return null;
  return {
    id,
    token,
    expiresAt: new Date(result.rows[0].expires_at).toISOString(),
  };
}

export async function listScheduleInvites(
  actorUserIdValue: string,
): Promise<ScheduleInviteSummary[]> {
  const actorUserId = normalizeScheduleUserId(actorUserIdValue);
  if (!actorUserId) return [];
  const pool = requireSchedulePool();
  await ensureScheduleSchema(pool);
  const result = await pool.query<{
    id: string;
    created_at: Date | string;
    expires_at: Date | string;
    claimed_at: Date | string | null;
    revoked_at: Date | string | null;
  }>(
    `SELECT i.id, i.created_at, i.expires_at, i.claimed_at, i.revoked_at
       FROM schedule_invites i
       JOIN schedule_users u ON u.id = $1
      WHERE i.created_by_user_id = $1
        AND u.role = 'owner'
        AND u.disabled_at IS NULL
        AND i.claimed_at IS NULL
        AND i.revoked_at IS NULL
        AND i.expires_at > NOW()
      ORDER BY i.created_at DESC
      LIMIT 50`,
    [actorUserId],
  );
  const now = Date.now();
  return result.rows.map((row) => {
    const expiresAt = new Date(row.expires_at).toISOString();
    const status: ScheduleInviteSummary["status"] = row.revoked_at
      ? "revoked"
      : row.claimed_at
        ? "claimed"
        : new Date(expiresAt).getTime() <= now
          ? "expired"
          : "available";
    return {
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt,
      status,
    };
  });
}

export async function revokeScheduleInvite(
  actorUserIdValue: string,
  inviteIdValue: string,
): Promise<boolean> {
  const actorUserId = normalizeScheduleUserId(actorUserIdValue);
  const inviteId = normalizeScheduleUserId(inviteIdValue);
  if (!actorUserId || !inviteId) return false;
  const pool = requireSchedulePool();
  await ensureScheduleSchema(pool);
  const result = await pool.query(
    `UPDATE schedule_invites i
        SET revoked_at = NOW()
       FROM schedule_users u
      WHERE i.id = $2
        AND i.created_by_user_id = $1
        AND i.claimed_at IS NULL
        AND i.revoked_at IS NULL
        AND u.id = $1
        AND u.role = 'owner'
        AND u.disabled_at IS NULL`,
    [actorUserId, inviteId],
  );
  return result.rowCount === 1;
}
