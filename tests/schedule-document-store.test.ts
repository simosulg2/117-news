import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";

import type { EncryptedSchedulePayload } from "../features/schedule/server/schedule-crypto.ts";
import { ScheduleDataUnavailableError } from "../features/schedule/server/schedule-errors.ts";
import { saveUserScheduleWithClient } from "../features/schedule/server/schedule-revision.server.ts";

const USER_ID = "4a6ab1fd-5f1a-4ad8-ae57-77b20fcbd63f";
const PAYLOAD: EncryptedSchedulePayload = {
  version: 1,
  algorithm: "aes-256-gcm",
  iv: "AAAAAAAAAAAAAAAA",
  tag: "AAAAAAAAAAAAAAAAAAAAAA",
  ciphertext: "private-ciphertext",
};

type QueryCall = Readonly<{ text: string; values: unknown[] | undefined }>;

test("schedule saves use an owner-scoped compare-and-swap revision update", async () => {
  const calls: QueryCall[] = [];
  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return { rows: [{ revision: "8" }] };
    },
  } as unknown as Pick<PoolClient, "query">;

  assert.deepEqual(
    await saveUserScheduleWithClient(client, USER_ID, 7, PAYLOAD),
    { updated: true, revision: 8 },
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /d\.user_id = \$1/u);
  assert.match(calls[0].text, /d\.revision = \$2/u);
  assert.match(calls[0].text, /revision = d\.revision \+ 1/u);
  assert.match(calls[0].text, /u\.disabled_at IS NULL/u);
  assert.deepEqual(calls[0].values?.slice(0, 2), [USER_ID, 7]);
  assert.deepEqual(JSON.parse(String(calls[0].values?.[2])), PAYLOAD);
});

test("a stale schedule save reports the current revision without overwriting", async () => {
  const calls: QueryCall[] = [];
  const client = {
    async query(text: string, values?: unknown[]) {
      calls.push({ text, values });
      return calls.length === 1
        ? { rows: [] }
        : { rows: [{ revision: 9 }] };
    },
  } as unknown as Pick<PoolClient, "query">;

  assert.deepEqual(
    await saveUserScheduleWithClient(client, USER_ID, 7, PAYLOAD),
    { updated: false, revision: 9 },
  );
  assert.equal(calls.length, 2);
  assert.match(calls[1].text, /SELECT d\.revision/u);
  assert.match(calls[1].text, /d\.user_id = \$1/u);
  assert.deepEqual(calls[1].values, [USER_ID]);
});

test("a schedule cannot be saved for a missing or disabled owner", async () => {
  const client = {
    async query() {
      return { rows: [] };
    },
  } as unknown as Pick<PoolClient, "query">;

  await assert.rejects(
    saveUserScheduleWithClient(client, USER_ID, 1, PAYLOAD),
    ScheduleDataUnavailableError,
  );
});
