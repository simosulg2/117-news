import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decryptSchedulePayload,
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
