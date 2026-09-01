import encryptedSchedule from "@/data/schedule.enc.json";
import { isScheduleDevelopmentBypassEnabled } from "@/features/auth/server/schedule-auth-policy";
import { parseScheduleData } from "@/features/schedule/model/schedule-validation";

import { decryptSchedulePayload } from "./schedule-crypto";
import {
  loadOrCreateUserSchedule,
  saveUserSchedule,
  ScheduleDataUnavailableError,
  ScheduleRevisionConflictError,
  type UserScheduleDocument,
} from "./schedule-user-store.server";

export { ScheduleDataUnavailableError, ScheduleRevisionConflictError };
export type { UserScheduleDocument };

export type ScheduleSourceUser = Readonly<{
  id: string | null;
  developmentBypass: boolean;
}>;

type DevelopmentScheduleGlobal = typeof globalThis & {
  __developmentSchedule117?: UserScheduleDocument;
};

function developmentBypassActive(user: ScheduleSourceUser): boolean {
  return user.developmentBypass
    && isScheduleDevelopmentBypassEnabled(process.env);
}

function loadDevelopmentTemplate(): UserScheduleDocument {
  const shared = globalThis as DevelopmentScheduleGlobal;
  if (shared.__developmentSchedule117) return shared.__developmentSchedule117;
  const key = process.env.SCHEDULE_DATA_KEY?.trim();
  if (!key) throw new ScheduleDataUnavailableError();
  try {
    shared.__developmentSchedule117 = {
      data: parseScheduleData(decryptSchedulePayload(encryptedSchedule, key)),
      revision: 1,
    };
    return shared.__developmentSchedule117;
  } catch {
    throw new ScheduleDataUnavailableError();
  }
}

/** Must only be called with the result of requireScheduleUser(). */
export async function loadScheduleData(
  user: ScheduleSourceUser,
): Promise<UserScheduleDocument> {
  if (developmentBypassActive(user)) return loadDevelopmentTemplate();
  if (!user.id) throw new ScheduleDataUnavailableError();
  return loadOrCreateUserSchedule(user.id);
}

/** In development bypass mode edits are process-local and never reach production storage. */
export async function saveScheduleData(
  user: ScheduleSourceUser,
  expectedRevision: number,
  input: unknown,
): Promise<UserScheduleDocument> {
  if (developmentBypassActive(user)) {
    const current = loadDevelopmentTemplate();
    if (current.revision !== expectedRevision) {
      throw new ScheduleRevisionConflictError(current.revision);
    }
    const next: UserScheduleDocument = {
      data: parseScheduleData(input),
      revision: current.revision + 1,
    };
    (globalThis as DevelopmentScheduleGlobal).__developmentSchedule117 = next;
    return next;
  }
  if (!user.id) throw new ScheduleDataUnavailableError();
  return saveUserSchedule(user.id, expectedRevision, input);
}
