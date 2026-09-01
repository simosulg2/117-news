export type ScheduleSessionToken = {
  sub?: string;
  iat?: number;
  scheduleUserId?: string;
  scheduleIsAdmin?: boolean;
  scheduleSessionMode?: "short" | "remembered";
  scheduleSessionExpiresAt?: number;
};

export const SHORT_SCHEDULE_SESSION_MS = 8 * 60 * 60 * 1_000;
export const REMEMBERED_SCHEDULE_SESSION_MS = 30 * 24 * 60 * 60 * 1_000;

type ScheduleSessionAccess = Readonly<{
  id: string;
  isAdmin: boolean;
}>;

export function beginScheduleSession<T extends ScheduleSessionToken>(
  token: T,
  remembered: boolean,
  now: number = Date.now(),
): T {
  token.scheduleSessionMode = remembered ? "remembered" : "short";
  token.scheduleSessionExpiresAt = now + (
    remembered ? REMEMBERED_SCHEDULE_SESSION_MS : SHORT_SCHEDULE_SESSION_MS
  );
  return token;
}

/** Enforces the selected lifetime and rolls remembered sessions while active. */
export function refreshScheduleSession<T extends ScheduleSessionToken>(
  token: T,
  now: number = Date.now(),
): boolean {
  let mode = token.scheduleSessionMode === "remembered" ? "remembered" : "short";
  let expiresAt = Number.isFinite(token.scheduleSessionExpiresAt)
    ? token.scheduleSessionExpiresAt!
    : null;

  if (expiresAt === null) {
    const issuedAt = Number.isFinite(token.iat) ? token.iat! * 1_000 : now;
    expiresAt = issuedAt + SHORT_SCHEDULE_SESSION_MS;
    mode = "short";
    token.scheduleSessionMode = "short";
    token.scheduleSessionExpiresAt = expiresAt;
  }
  if (expiresAt <= now) return false;

  if (mode === "remembered") {
    token.scheduleSessionExpiresAt = now + REMEMBERED_SCHEDULE_SESSION_MS;
  }
  return true;
}

/** Replaces Auth.js's provider subject with the opaque schedule user identity. */
export function applyScheduleAccessToToken<T extends ScheduleSessionToken>(
  token: T,
  access: ScheduleSessionAccess | null,
): T {
  if (access) {
    token.sub = access.id;
    token.scheduleUserId = access.id;
    token.scheduleIsAdmin = access.isAdmin;
  } else {
    delete token.sub;
    delete token.scheduleUserId;
    delete token.scheduleIsAdmin;
  }
  return token;
}
