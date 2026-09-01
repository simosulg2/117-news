import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decryptSchedulePayload,
  decryptScheduleForUser,
  deriveScheduleUserKey,
  encryptScheduleForUser,
  encryptSchedulePayload,
  parseEncryptedSchedulePayload,
  type EncryptedSchedulePayload,
} from "../features/schedule/server/schedule-crypto.ts";

function encryptFixture(value: unknown, key: Buffer): EncryptedSchedulePayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("117.ee/schedule/v1", "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
    cipher.final(),
  ]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

test("decryptSchedulePayload authenticates and decodes a private payload", () => {
  const key = randomBytes(32);
  const expected = { version: "test", events: [] };
  const payload = encryptFixture(expected, key);

  assert.deepEqual(decryptSchedulePayload(payload, key.toString("base64url")), expected);
});

test("encryptSchedulePayload produces a fresh authenticated envelope", () => {
  const key = randomBytes(32).toString("base64url");
  const value = { version: "test", events: [{ id: "private-event" }] };

  const first = encryptSchedulePayload(value, key);
  const second = encryptSchedulePayload(value, key);

  assert.deepEqual(decryptSchedulePayload(first, key), value);
  assert.deepEqual(decryptSchedulePayload(second, key), value);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test("per-user keys and authenticated context isolate schedule ciphertext", () => {
  const masterKey = randomBytes(32).toString("base64url");
  const ownerId = "4a6ab1fd-5f1a-4ad8-ae57-77b20fcbd63f";
  const otherId = "a1246d8e-e557-4607-af50-33b890de37f9";
  const ownerKey = deriveScheduleUserKey(masterKey, ownerId);
  const otherKey = deriveScheduleUserKey(masterKey, otherId);
  const payload = encryptScheduleForUser(
    { title: "Owner private schedule" },
    masterKey,
    ownerId,
  );

  assert.equal(Buffer.from(ownerKey, "base64url").length, 32);
  assert.notEqual(ownerKey, otherKey);
  assert.deepEqual(
    decryptScheduleForUser(payload, masterKey, ownerId),
    { title: "Owner private schedule" },
  );
  assert.throws(() => decryptScheduleForUser(payload, masterKey, otherId));
});

test("per-user key derivation normalizes UUIDs and rejects non-user identities", () => {
  const masterKey = randomBytes(32).toString("base64url");
  const userId = "4a6ab1fd-5f1a-4ad8-ae57-77b20fcbd63f";

  assert.equal(
    deriveScheduleUserKey(masterKey, userId),
    deriveScheduleUserKey(masterKey, userId),
  );
  assert.equal(
    deriveScheduleUserKey(masterKey, userId),
    deriveScheduleUserKey(masterKey, `  ${userId.toUpperCase()}  `),
  );
  assert.throws(() => deriveScheduleUserKey(masterKey, ""));
  assert.throws(() => deriveScheduleUserKey(masterKey, "12345678"));
  assert.throws(() => deriveScheduleUserKey(masterKey, "github-login-name"));
  assert.throws(() => deriveScheduleUserKey(masterKey, "4a6ab1fd-5f1a-0ad8-ae57-77b20fcbd63f"));
});

test("decryptSchedulePayload rejects the wrong key and modified ciphertext", () => {
  const key = randomBytes(32);
  const payload = encryptFixture({ private: true }, key);

  assert.throws(() => decryptSchedulePayload(payload, randomBytes(32).toString("base64url")));
  assert.throws(() => decryptSchedulePayload({ ...payload, ciphertext: `${payload.ciphertext}A` }, key.toString("base64url")));
});

test("parseEncryptedSchedulePayload rejects extra fields and oversized data", () => {
  const key = randomBytes(32);
  const payload = encryptFixture({ ok: true }, key);

  assert.throws(() => parseEncryptedSchedulePayload({ ...payload, hint: "private" }));
  assert.throws(() => parseEncryptedSchedulePayload({ ...payload, ciphertext: "A".repeat(200_001) }));
});

test("the committed private schedule is an authenticated ciphertext envelope", async () => {
  const contents = await readFile(new URL("../data/schedule.enc.json", import.meta.url), "utf8");
  const payload = parseEncryptedSchedulePayload(JSON.parse(contents) as unknown);

  assert.equal(payload.algorithm, "aes-256-gcm");
  assert.ok(payload.ciphertext.length > 1_000);
});
