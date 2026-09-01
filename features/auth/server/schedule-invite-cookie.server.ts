import { cookies } from "next/headers";

const PRODUCTION_COOKIE_NAME = "__Secure-117-schedule-invite";
const DEVELOPMENT_COOKIE_NAME = "117-schedule-invite";
const COOKIE_PATH = "/api/auth";

function cookieName(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME;
}

export async function setPendingScheduleInviteToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: 10 * 60,
  });
}

export async function clearPendingScheduleInviteToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    expires: new Date(0),
  });
}

/** Reads and expires the one-time OAuth bridge cookie. */
export async function takePendingScheduleInviteToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const name = cookieName();
  const value = cookieStore.get(name)?.value;
  await clearPendingScheduleInviteToken();
  return value;
}
