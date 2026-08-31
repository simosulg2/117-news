import { createDecipheriv } from "node:crypto";

const AAD = Buffer.from("117.ee/schedule/v1", "utf8");
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const MAX_CIPHERTEXT_CHARACTERS = 200_000;

export type EncryptedSchedulePayload = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function encodedPart(value: unknown, maximumLength: number): string | null {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximumLength
    && BASE64URL_PATTERN.test(value)
    ? value
    : null;
}

export function parseEncryptedSchedulePayload(value: unknown): EncryptedSchedulePayload {
  const candidate = record(value);
  const keys = candidate ? Object.keys(candidate).sort() : [];
  if (!candidate || keys.join(",") !== "algorithm,ciphertext,iv,tag,version") {
    throw new Error("Invalid encrypted schedule envelope.");
  }

  const iv = encodedPart(candidate.iv, 32);
  const tag = encodedPart(candidate.tag, 32);
  const ciphertext = encodedPart(candidate.ciphertext, MAX_CIPHERTEXT_CHARACTERS);
  if (candidate.version !== 1 || candidate.algorithm !== "aes-256-gcm" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted schedule envelope.");
  }

  return { version: 1, algorithm: "aes-256-gcm", iv, tag, ciphertext };
}

export function decryptSchedulePayload(payloadValue: unknown, encodedKey: string): unknown {
  if (!BASE64URL_PATTERN.test(encodedKey) || encodedKey.length > 64) {
    throw new Error("Invalid schedule key.");
  }

  const key = Buffer.from(encodedKey, "base64url");
  const payload = parseEncryptedSchedulePayload(payloadValue);
  const iv = Buffer.from(payload.iv, "base64url");
  const tag = Buffer.from(payload.tag, "base64url");
  if (key.length !== 32 || iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid schedule encryption parameters.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as unknown;
}
