import encryptedScheduleTemplate from "@/data/schedule.enc.json";
import {
  ensureScheduleSchema,
  requireSchedulePool,
  SchedulePersistenceUnavailableError,
} from "@/features/auth/server/schedule-database.server";
import { normalizeScheduleUserId } from "@/features/auth/server/schedule-user-store.server";
import { parseScheduleDataForSave } from "@/features/schedule/model/schedule-validation";
import { canonicalizeScheduleData } from "@/features/schedule/model/schedule-derived-events";
import type { ScheduleData } from "@/lib/schedule-types";
import { encryptScheduleForUser } from "./schedule-crypto";
import {
  ScheduleDataUnavailableError,
  ScheduleRevisionConflictError,
} from "./schedule-errors";
import { saveUserScheduleWithClient } from "./schedule-revision.server";
import {
  loadOrCreateUserScheduleWithClient,
  type UserScheduleDocument,
} from "./schedule-template.server";

export {
  ScheduleDataUnavailableError,
  ScheduleRevisionConflictError,
};

export type { UserScheduleDocument };

function scheduleMasterKey(): string {
  const value = process.env.SCHEDULE_DATA_KEY?.trim() ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) {
    throw new ScheduleDataUnavailableError();
  }
  return value;
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
    return await loadOrCreateUserScheduleWithClient(
      pool,
      userId,
      masterKey,
      encryptedScheduleTemplate,
    );
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

  const data = canonicalizeScheduleData(parseScheduleDataForSave(input));
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
