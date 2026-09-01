import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import type { PoolClient } from "pg";

import type { ScheduleData } from "../lib/schedule-types.ts";
import { buildScheduleTimelineEvents } from "../features/schedule/model/schedule-derived-events.ts";
import {
  decryptScheduleForUser,
  encryptSchedulePayload,
  type EncryptedSchedulePayload,
} from "../features/schedule/server/schedule-crypto.ts";
import { loadOrCreateUserScheduleWithClient } from "../features/schedule/server/schedule-template.server.ts";

const USER_ID = "4a6ab1fd-5f1a-4ad8-ae57-77b20fcbd63f";
const OTHER_USER_ID = "a1246d8e-e557-4607-af50-33b890de37f9";

const SHARED_TEMPLATE: ScheduleData = {
  version: "test",
  title: "Ühine ajakava mall",
  subtitle: "Uue konto algseis",
  timeZone: "Europe/Tallinn",
  events: [
    {
      id: "school-monday-1",
      day: 1,
      startMinute: 510,
      endMinute: 585,
      title: "Esimene tund",
      category: "school",
    },
    {
      id: "personal-monday",
      day: 1,
      startMinute: 960,
      endMinute: 1_020,
      title: "Isiklik tegevus",
      category: "free",
    },
  ],
  schoolPeriods: [{
    id: "period-monday-1",
    day: 1,
    period: "1",
    timeWindow: "08:30–09:45",
    subjectEt: "Näidistund",
    note: "",
  }],
  routines: [{
    id: "morning-start",
    section: "morning",
    timeWindow: "07:00–07:15",
    title: "Hommik",
    details: "",
    category: "routine",
  }],
  studyPlans: [{
    id: "study-plan",
    day: 2,
    window: "16:00–17:00",
    maxHours: 1,
    actualHours: null,
    focus: "",
    difficulty: "",
    status: "",
  }],
  metrics: [{ id: "weekly-balance", label: "Tasakaal", hours: 7, detail: "" }],
};

test("a new account receives a complete private clone of the shared template", async () => {
  const masterKey = randomBytes(32).toString("base64url");
  const encryptedTemplate = encryptSchedulePayload(SHARED_TEMPLATE, masterKey);
  let storedPayload: EncryptedSchedulePayload | null = null;
  let insertCount = 0;

  const client = {
    async query(text: string, values?: unknown[]) {
      if (text.includes("SELECT d.encrypted_payload")) {
        return {
          rows: storedPayload
            ? [{ encrypted_payload: storedPayload, revision: 1 }]
            : [],
        };
      }
      if (text.includes("INSERT INTO schedule_documents")) {
        insertCount += 1;
        storedPayload = JSON.parse(String(values?.[1])) as EncryptedSchedulePayload;
        return { rows: [] };
      }
      throw new Error("Unexpected schedule query in test.");
    },
  } as unknown as Pick<PoolClient, "query">;

  const first = await loadOrCreateUserScheduleWithClient(
    client,
    USER_ID,
    masterKey,
    encryptedTemplate,
  );

  assert.equal(first.revision, 1);
  assert.equal(first.data.schoolPeriods.length, 1);
  assert.equal(first.data.events.length, 2);
  assert.equal(first.data.routines.length, 1);
  assert.equal(first.data.studyPlans.length, 1);
  assert.equal(first.data.metrics.length, 1);
  assert.equal(buildScheduleTimelineEvents(first.data).length, 7);
  assert.equal(insertCount, 1);
  assert.ok(storedPayload);
  assert.deepEqual(
    decryptScheduleForUser(storedPayload, masterKey, USER_ID),
    first.data,
  );
  assert.throws(() => decryptScheduleForUser(storedPayload, masterKey, OTHER_USER_ID));

  const second = await loadOrCreateUserScheduleWithClient(
    client,
    USER_ID,
    masterKey,
    encryptedTemplate,
  );
  assert.deepEqual(second, first);
  assert.equal(insertCount, 1);
});
