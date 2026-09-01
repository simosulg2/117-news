import type { PoolClient } from "pg";

import type { EncryptedSchedulePayload } from "./schedule-crypto.ts";
import { ScheduleDataUnavailableError } from "./schedule-errors.ts";

export type ScheduleRevisionUpdate = Readonly<{
  updated: boolean;
  revision: number;
}>;

function revision(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ScheduleDataUnavailableError();
  }
  return parsed;
}

/** Compare-and-swap update, separated for verification without a live database. */
export async function saveUserScheduleWithClient(
  client: Pick<PoolClient, "query">,
  userId: string,
  expectedRevision: number,
  payload: EncryptedSchedulePayload,
): Promise<ScheduleRevisionUpdate> {
  const updated = await client.query<{ revision: string | number }>(
    `UPDATE schedule_documents d
        SET encrypted_payload = $3::jsonb,
            revision = d.revision + 1,
            updated_at = NOW()
       FROM schedule_users u
      WHERE d.user_id = $1
        AND d.revision = $2
        AND u.id = d.user_id
        AND u.disabled_at IS NULL
      RETURNING d.revision`,
    [userId, expectedRevision, JSON.stringify(payload)],
  );
  if (updated.rows[0]) {
    return { updated: true, revision: revision(updated.rows[0].revision) };
  }

  const current = await client.query<{ revision: string | number }>(
    `SELECT d.revision
       FROM schedule_documents d
       JOIN schedule_users u ON u.id = d.user_id
      WHERE d.user_id = $1
        AND u.disabled_at IS NULL
      LIMIT 1`,
    [userId],
  );
  if (!current.rows[0]) throw new ScheduleDataUnavailableError();
  return { updated: false, revision: revision(current.rows[0].revision) };
}
