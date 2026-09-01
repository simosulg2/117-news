export type ScheduleSessionToken = {
  sub?: string;
  scheduleUserId?: string;
  scheduleIsAdmin?: boolean;
};

type ScheduleSessionAccess = Readonly<{
  id: string;
  isAdmin: boolean;
}>;

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
