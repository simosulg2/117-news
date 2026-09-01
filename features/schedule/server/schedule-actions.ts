"use server";

import { revalidatePath } from "next/cache";

import { requireScheduleUser } from "@/features/auth/server/require-schedule-user";
import { ScheduleValidationError } from "@/features/schedule/model/schedule-validation";

import {
  saveScheduleData,
  ScheduleDataUnavailableError,
  ScheduleRevisionConflictError,
} from "./schedule-source.server";

export type SaveScheduleActionResult =
  | Readonly<{ ok: true; revision: number }>
  | Readonly<{
    ok: false;
    error: "conflict" | "invalid" | "unavailable";
    revision?: number;
  }>;

export async function saveScheduleAction(
  input: unknown,
  expectedRevision: number,
): Promise<SaveScheduleActionResult> {
  const user = await requireScheduleUser();
  try {
    const saved = await saveScheduleData(user, expectedRevision, input);
    revalidatePath("/ajakava");
    return { ok: true, revision: saved.revision };
  } catch (error) {
    if (error instanceof ScheduleRevisionConflictError) {
      return {
        ok: false,
        error: "conflict",
        revision: error.currentRevision,
      };
    }
    if (error instanceof ScheduleValidationError) {
      return { ok: false, error: "invalid" };
    }
    if (error instanceof ScheduleDataUnavailableError) {
      return { ok: false, error: "unavailable" };
    }
    return { ok: false, error: "unavailable" };
  }
}
