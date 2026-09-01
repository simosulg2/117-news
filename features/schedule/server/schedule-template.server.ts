import type { PoolClient } from "pg";

import { parseScheduleData } from "../model/schedule-validation.ts";
import { canonicalizeScheduleData } from "../model/schedule-derived-events.ts";
import type { ScheduleData } from "../../../lib/schedule-types.ts";
import {
  decryptScheduleForUser,
  decryptSchedulePayload,
  encryptScheduleForUser,
  type EncryptedSchedulePayload,
} from "./schedule-crypto.ts";
import { ScheduleDataUnavailableError } from "./schedule-errors.ts";

export type UserScheduleDocument = Readonly<{
  data: ScheduleData;
  revision: number;
}>;

type StoredScheduleRow = {
  encrypted_payload: unknown;
  revision: string | number;
};

function revision(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ScheduleDataUnavailableError();
  }
  return parsed;
}

function decryptStoredSchedule(
  row: StoredScheduleRow,
  masterKey: string,
  userId: string,
): UserScheduleDocument {
  return {
    data: canonicalizeScheduleData(parseScheduleData(
      decryptScheduleForUser(row.encrypted_payload, masterKey, userId),
    )),
    revision: revision(row.revision),
  };
}

async function findStoredSchedule(
  client: Pick<PoolClient, "query">,
  userId: string,
): Promise<StoredScheduleRow | null> {
  const result = await client.query<StoredScheduleRow>(
    `SELECT d.encrypted_payload, d.revision
       FROM schedule_documents d
       JOIN schedule_users u ON u.id = d.user_id
      WHERE d.user_id = $1
        AND u.disabled_at IS NULL
      LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

function cloneEncryptedTemplate(
  encryptedTemplate: unknown,
  masterKey: string,
  userId: string,
): Readonly<{ data: ScheduleData; payload: EncryptedSchedulePayload }> {
  const data = canonicalizeScheduleData(parseScheduleData(
    decryptSchedulePayload(encryptedTemplate, masterKey),
  ));
  return {
    data,
    payload: encryptScheduleForUser(data, masterKey, userId),
  };
}

/** Creates a private first revision from the full shared template, never a blank document. */
export async function loadOrCreateUserScheduleWithClient(
  client: Pick<PoolClient, "query">,
  userId: string,
  masterKey: string,
  encryptedTemplate: unknown,
): Promise<UserScheduleDocument> {
  let row = await findStoredSchedule(client, userId);
  if (!row) {
    const initial = cloneEncryptedTemplate(encryptedTemplate, masterKey, userId);
    await client.query(
      `INSERT INTO schedule_documents (user_id, revision, encrypted_payload)
       SELECT id, 1, $2::jsonb
         FROM schedule_users
        WHERE id = $1 AND disabled_at IS NULL
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, JSON.stringify(initial.payload)],
    );
    row = await findStoredSchedule(client, userId);
  }
  if (!row) throw new ScheduleDataUnavailableError();
  return decryptStoredSchedule(row, masterKey, userId);
}
