import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const AAD = Buffer.from("117.ee/schedule/v1", "utf8");
const USER_KEY_SALT = Buffer.from("117.ee/schedule/user-key/v1", "utf8");
const USER_AAD_PREFIX = "117.ee/schedule/user-payload/v1";
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const SCHEDULE_USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
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

function decodeScheduleKey(encodedKey: string): Buffer {
  if (!BASE64URL_PATTERN.test(encodedKey) || encodedKey.length > 64) {
    throw new Error("Invalid schedule key.");
  }

  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32) throw new Error("Invalid schedule key.");
  return key;
}

function scheduleUserId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!SCHEDULE_USER_ID_PATTERN.test(normalized)) {
    throw new Error("Invalid schedule user identity.");
  }
  return normalized;
}

function userAdditionalData(userId: string): Buffer {
  return Buffer.from(`${USER_AAD_PREFIX}\0${scheduleUserId(userId)}`, "utf8");
}

export function encryptSchedulePayload(
  value: unknown,
  encodedKey: string,
  additionalData: Uint8Array = AAD,
): EncryptedSchedulePayload {
  const key = decodeScheduleKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(additionalData);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
    cipher.final(),
  ]);
  const encodedCiphertext = ciphertext.toString("base64url");
  if (encodedCiphertext.length > MAX_CIPHERTEXT_CHARACTERS) {
    throw new Error("Encrypted schedule payload is too large.");
  }
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: encodedCiphertext,
  };
}

export function decryptSchedulePayload(
  payloadValue: unknown,
  encodedKey: string,
  additionalData: Uint8Array = AAD,
): unknown {
  const key = decodeScheduleKey(encodedKey);
  const payload = parseEncryptedSchedulePayload(payloadValue);
  const iv = Buffer.from(payload.iv, "base64url");
  const tag = Buffer.from(payload.tag, "base64url");
  if (iv.length !== 12 || tag.length !== 16) {
    throw new Error("Invalid schedule encryption parameters.");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(additionalData);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as unknown;
}

/** Derives a unique data-encryption key without persisting another secret. */
export function deriveScheduleUserKey(
  encodedMasterKey: string,
  userId: string,
): string {
  const masterKey = decodeScheduleKey(encodedMasterKey);
  const normalizedUserId = scheduleUserId(userId);
  const derived = hkdfSync(
    "sha256",
    masterKey,
    USER_KEY_SALT,
    Buffer.from(normalizedUserId, "utf8"),
    32,
  );
  return Buffer.from(derived).toString("base64url");
}

export function encryptScheduleForUser(
  value: unknown,
  encodedMasterKey: string,
  userId: string,
): EncryptedSchedulePayload {
  return encryptSchedulePayload(
    value,
    deriveScheduleUserKey(encodedMasterKey, userId),
    userAdditionalData(userId),
  );
}

export function decryptScheduleForUser(
  payloadValue: unknown,
  encodedMasterKey: string,
  userId: string,
): unknown {
  return decryptSchedulePayload(
    payloadValue,
    deriveScheduleUserKey(encodedMasterKey, userId),
    userAdditionalData(userId),
  );
}
