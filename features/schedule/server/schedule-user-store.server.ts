import encryptedScheduleTemplate from "@/data/schedule.enc.json";
import {
  ensureScheduleSchema,
  requireSchedulePool,
  SchedulePersistenceUnavailableError,
} from "@/features/auth/server/schedule-database.server";
import { normalizeScheduleUserId } from "@/features/auth/server/schedule-user-store.server";
import { parseScheduleData } from "@/features/schedule/model/schedule-validation";
import type { ScheduleData } from "@/lib/schedule-types";
import type { PoolClient } from "pg";
import {
  decryptScheduleForUser,
  decryptSchedulePayload,
  encryptScheduleForUser,
} from "./schedule-crypto";
import {
  ScheduleDataUnavailableError,
  ScheduleRevisionConflictError,
} from "./schedule-errors";
import { saveUserScheduleWithClient } from "./schedule-revision.server";

export {
  ScheduleDataUnavailableError,
  ScheduleRevisionConflictError,
};

export type UserScheduleDocument = Readonly<{
  data: ScheduleData;
  revision: number;
}>;

type StoredScheduleRow = {
  encrypted_payload: unknown;
  revision: string | number;
};

function scheduleMasterKey(): string {
  const value = process.env.SCHEDULE_DATA_KEY?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) {
    throw new ScheduleDataUnavailableError();
  }
  return value;
}

function revision(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ScheduleDataUnavailableError();
  }
  return parsed;
}

function encryptedTemplate(masterKey: string): ScheduleData {
  return parseScheduleData(decryptSchedulePayload(encryptedScheduleTemplate, masterKey));
}

function decryptStoredSchedule(
  row: StoredScheduleRow,
  masterKey: string,
  userId: string,
): UserScheduleDocument {
  return {
    data: parseScheduleData(
      decryptScheduleForUser(row.encrypted_payload, masterKey, userId),
    ),
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

/** Loads an owner-scoped document, cloning the encrypted template on first access. */
export async function loadOrCreateUserSchedule(
  userIdValue: string,
): Promise<UserScheduleDocument> {
  const userId = normalizeScheduleUserId(userIdValue);
  if (!userId) throw new ScheduleDataUnavailableError();

  try {
    const masterKey = scheduleMasterKey();
    const pool = requireSchedulePool();
    await ensureScheduleSchema(pool);
    let row = await findStoredSchedule(pool, userId);
    if (!row) {
      const initialData = encryptedTemplate(masterKey);
      const payload = encryptScheduleForUser(initialData, masterKey, userId);
      await pool.query(
        `INSERT INTO schedule_documents (user_id, revision, encrypted_payload)
         SELECT id, 1, $2::jsonb
           FROM schedule_users
          WHERE id = $1 AND disabled_at IS NULL
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, JSON.stringify(payload)],
      );
      row = await findStoredSchedule(pool, userId);
    }
    if (!row) throw new ScheduleDataUnavailableError();
    return decryptStoredSchedule(row, masterKey, userId);
  } catch (error) {
    if (error instanceof ScheduleDataUnavailableError) throw error;
    throw new ScheduleDataUnavailableError();
  }
}

export async function saveUserSchedule(
  userIdValue: string,
  expectedRevision: number,
  input: unknown,
): Promise<UserScheduleDocument> {
  const userId = normalizeScheduleUserId(userIdValue);
  if (!userId || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw new ScheduleDataUnavailableError();
  }

  const data = parseScheduleData(input);
  try {
    const masterKey = scheduleMasterKey();
    const payload = encryptScheduleForUser(data, masterKey, userId);
    const pool = requireSchedulePool();
    await ensureScheduleSchema(pool);
    const result = await saveUserScheduleWithClient(
      pool,
      userId,
      expectedRevision,
      payload,
    );
    if (!result.updated) throw new ScheduleRevisionConflictError(result.revision);
    return { data, revision: result.revision };
  } catch (error) {
    if (
      error instanceof ScheduleRevisionConflictError
      || error instanceof ScheduleDataUnavailableError
    ) {
      throw error;
    }
    if (error instanceof SchedulePersistenceUnavailableError) {
      throw new ScheduleDataUnavailableError();
    }
    throw new ScheduleDataUnavailableError();
  }
}
