import assert from "node:assert/strict";
import test from "node:test";

import { applyScheduleAccessToToken } from "../features/auth/server/schedule-session-token.ts";

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
