import assert from "node:assert/strict";
import test from "node:test";

import {
  applyScheduleAccessToToken,
  beginScheduleSession,
  refreshScheduleSession,
  REMEMBERED_SCHEDULE_SESSION_MS,
  SHORT_SCHEDULE_SESSION_MS,
  type ScheduleSessionToken,
} from "../features/auth/server/schedule-session-token.ts";

test("starts short and remembered schedule sessions with separate lifetimes", () => {
  const now = 1_800_000_000_000;
  const shortToken = beginScheduleSession<ScheduleSessionToken>({}, false, now);
  const rememberedToken = beginScheduleSession<ScheduleSessionToken>({}, true, now);

  assert.deepEqual(shortToken, {
    scheduleSessionMode: "short",
    scheduleSessionExpiresAt: now + SHORT_SCHEDULE_SESSION_MS,
  });
  assert.deepEqual(rememberedToken, {
    scheduleSessionMode: "remembered",
    scheduleSessionExpiresAt: now + REMEMBERED_SCHEDULE_SESSION_MS,
  });
});

test("remembered sessions roll while short sessions keep their fixed deadline", () => {
  const now = 1_800_000_000_000;
  const shortToken = beginScheduleSession<ScheduleSessionToken>({}, false, now);
  const rememberedToken = beginScheduleSession<ScheduleSessionToken>({}, true, now);
  const later = now + 60_000;

  assert.equal(refreshScheduleSession(shortToken, later), true);
  assert.equal(shortToken.scheduleSessionExpiresAt, now + SHORT_SCHEDULE_SESSION_MS);
  assert.equal(refreshScheduleSession(rememberedToken, later), true);
  assert.equal(
    rememberedToken.scheduleSessionExpiresAt,
    later + REMEMBERED_SCHEDULE_SESSION_MS,
  );
});

test("expired and legacy sessions fail closed against the eight-hour limit", () => {
  const issuedAtSeconds = 1_800_000_000;
  const deadline = issuedAtSeconds * 1_000 + SHORT_SCHEDULE_SESSION_MS;
  const legacyToken = { iat: issuedAtSeconds };

  assert.equal(refreshScheduleSession(legacyToken, deadline - 1), true);
  assert.equal(refreshScheduleSession(legacyToken, deadline), false);

  const expired = beginScheduleSession<ScheduleSessionToken>({}, true, deadline);
  assert.equal(
    refreshScheduleSession(expired, deadline + REMEMBERED_SCHEDULE_SESSION_MS),
    false,
  );

  const malformedRemembered: ScheduleSessionToken = {
    iat: issuedAtSeconds,
    scheduleSessionMode: "remembered",
    scheduleSessionExpiresAt: Number.NaN,
  };
  assert.equal(refreshScheduleSession(malformedRemembered, deadline - 1), true);
  assert.equal(malformedRemembered.scheduleSessionMode, "short");
  assert.equal(malformedRemembered.scheduleSessionExpiresAt, deadline);
});

test("replaces the provider subject with the opaque schedule user id", () => {
  const opaqueId = "c36af356-f9c5-4f96-8c8c-d376f67f4414";
  const token = {
    sub: "12345678",
    scheduleUserId: undefined,
    scheduleIsAdmin: undefined,
  };

  assert.equal(applyScheduleAccessToToken(token, {
    id: opaqueId,
    isAdmin: true,
  }), token);
  assert.equal(token.sub, opaqueId);
  assert.equal(token.scheduleUserId, opaqueId);
  assert.equal(token.scheduleIsAdmin, true);
  assert.doesNotMatch(JSON.stringify(token), /12345678/u);
});

test("removes all schedule identity fields when access fails closed", () => {
  const token: {
    sub?: string;
    scheduleUserId?: string;
    scheduleIsAdmin?: boolean;
  } = {
    sub: "12345678",
    scheduleUserId: "c36af356-f9c5-4f96-8c8c-d376f67f4414",
    scheduleIsAdmin: true,
  };

  applyScheduleAccessToToken(token, null);

  assert.deepEqual(token, {});
});
