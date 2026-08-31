import encryptedSchedule from "@/data/schedule.enc.json";
import { parseScheduleData } from "@/features/schedule/model/schedule-validation";
import type { ScheduleData } from "@/lib/schedule-types";

import { decryptSchedulePayload } from "./schedule-crypto";

export class ScheduleDataUnavailableError extends Error {
  constructor() {
    super("Ajakava andmed pole seadistatud.");
    this.name = "ScheduleDataUnavailableError";
  }
}

export async function loadScheduleData(): Promise<ScheduleData> {
  const key = process.env.SCHEDULE_DATA_KEY?.trim();
  if (!key) throw new ScheduleDataUnavailableError();

  try {
    return parseScheduleData(decryptSchedulePayload(encryptedSchedule, key));
  } catch {
    throw new ScheduleDataUnavailableError();
  }
}
