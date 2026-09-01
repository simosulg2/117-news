import assert from "node:assert/strict";
import test from "node:test";

import {
  fixedScheduleRedirect,
  getScheduleAuthState,
  hasAuthJsSessionCookie,
  isAllowedScheduleGithubAccount,
  isScheduleDevelopmentBypassEnabled,
} from "../features/auth/server/schedule-auth-policy.ts";

const COMPLETE_ENVIRONMENT = {
  NODE_ENV: "production",
  AUTH_SECRET: "a-random-auth-secret-with-32-bytes-minimum",
  AUTH_GITHUB_ID: "github-client-id",
  AUTH_GITHUB_SECRET: "github-client-secret",
  AUTH_TRUST_HOST: "true",
  AUTH_URL: "https://117.ee",
  SCHEDULE_ALLOWED_GITHUB_ID: "12345678",
  DATABASE_URL: "postgresql://schedule:secret@database/schedule",
  SCHEDULE_DATA_KEY: "A".repeat(43),
} as const;

test("requires every server-side authentication setting", () => {
  assert.equal(getScheduleAuthState(COMPLETE_ENVIRONMENT).configured, true);

  for (const key of [
    "AUTH_SECRET",
    "AUTH_GITHUB_ID",
    "AUTH_GITHUB_SECRET",
    "SCHEDULE_ALLOWED_GITHUB_ID",
    "DATABASE_URL",
    "SCHEDULE_DATA_KEY",
  ] as const) {
    const environment = { ...COMPLETE_ENVIRONMENT, [key]: "  " };
    assert.equal(getScheduleAuthState(environment).configured, false, key);
  }

  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    AUTH_SECRET: "too-short",
  }).configured, false);
  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    AUTH_SECRET: "x".repeat(4_097),
  }).configured, false);
  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    AUTH_TRUST_HOST: "false",
  }).configured, false);
  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    AUTH_TRUST_HOST: undefined,
  }).configured, false);
  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    AUTH_URL: undefined,
  }).configured, false);
  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    AUTH_URL: "http://117.ee",
  }).configured, false);
  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    AUTH_URL: "https://attacker.example",
  }).configured, false);
  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    DATABASE_URL: "https://database.example/schedule",
  }).configured, false);
  assert.equal(getScheduleAuthState({
    ...COMPLETE_ENVIRONMENT,
    SCHEDULE_DATA_KEY: "too-short",
  }).configured, false);

  assert.equal(
    getScheduleAuthState({
      ...COMPLETE_ENVIRONMENT,
      SCHEDULE_ALLOWED_GITHUB_ID: "github-login-name",
    }).configured,
    false,
  );
});

test("matches only the exact stable GitHub provider account id", () => {
  assert.equal(isAllowedScheduleGithubAccount("12345678", COMPLETE_ENVIRONMENT), true);
  assert.equal(isAllowedScheduleGithubAccount("1234567", COMPLETE_ENVIRONMENT), false);
  assert.equal(isAllowedScheduleGithubAccount("012345678", COMPLETE_ENVIRONMENT), false);
  assert.equal(isAllowedScheduleGithubAccount("github-login-name", COMPLETE_ENVIRONMENT), false);
  assert.equal(isAllowedScheduleGithubAccount(undefined, COMPLETE_ENVIRONMENT), false);
});

test("production can never activate the development bypass", () => {
  assert.equal(isScheduleDevelopmentBypassEnabled({
    NODE_ENV: "production",
    SCHEDULE_DEV_BYPASS: "1",
  }), false);
  assert.equal(isScheduleDevelopmentBypassEnabled({
    SCHEDULE_DEV_BYPASS: "1",
  }), false);
  assert.equal(isScheduleDevelopmentBypassEnabled({
    NODE_ENV: "development",
    SCHEDULE_DEV_BYPASS: "1",
  }), true);
  assert.equal(isScheduleDevelopmentBypassEnabled({
    NODE_ENV: "test",
    SCHEDULE_DEV_BYPASS: "1",
  }), false);
  assert.equal(isScheduleDevelopmentBypassEnabled({
    NODE_ENV: "development",
    SCHEDULE_DEV_BYPASS: "true",
  }), false);

  const bypassWithoutCredentials = getScheduleAuthState({
    NODE_ENV: "development",
    SCHEDULE_DEV_BYPASS: "1",
  });
  assert.equal(bypassWithoutCredentials.configured, false);
  assert.equal(bypassWithoutCredentials.developmentBypass, true);
});

test("always replaces requested callback destinations with the private schedule", () => {
  assert.equal(
    fixedScheduleRedirect("https://attacker.example/phish", "https://117.ee"),
    "https://117.ee/ajakava",
  );
  assert.equal(
    fixedScheduleRedirect("/riigikogu", "https://117.ee/base?x=1"),
    "https://117.ee/ajakava",
  );
  assert.equal(fixedScheduleRedirect("https://attacker.example", "not-a-url"), "/ajakava");
  assert.equal(fixedScheduleRedirect("/", "javascript:alert(1)"), "/ajakava");
  assert.equal(fixedScheduleRedirect("/", "http://117.ee"), "/ajakava");
  assert.equal(fixedScheduleRedirect("/", "https://attacker.example"), "/ajakava");
  assert.equal(
    fixedScheduleRedirect("/", "http://localhost:3000"),
    "http://localhost:3000/ajakava",
  );
});

test("recognizes regular, secure, and chunked Auth.js session cookies", () => {
  assert.equal(hasAuthJsSessionCookie(["authjs.session-token"]), true);
  assert.equal(hasAuthJsSessionCookie(["__Secure-authjs.session-token"]), true);
  assert.equal(hasAuthJsSessionCookie(["authjs.session-token.0"]), true);
  assert.equal(hasAuthJsSessionCookie(["__Secure-authjs.session-token.1"]), true);
  assert.equal(hasAuthJsSessionCookie(["authjs.callback-url"]), false);
  assert.equal(hasAuthJsSessionCookie(["session-token"]), false);
});
