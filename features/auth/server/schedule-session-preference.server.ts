import { cookies } from "next/headers";

const PRODUCTION_COOKIE_NAME = "__Secure-117-schedule-remember";
const DEVELOPMENT_COOKIE_NAME = "117-schedule-remember";
const COOKIE_PATH = "/api/auth";

function cookieName(): string {
  return process.env.NODE_ENV === "production"
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME;
}

export function wantsRememberedScheduleSession(value: FormDataEntryValue | null): boolean {
  return value === "1";
}

export async function setPendingScheduleSessionPreference(remembered: boolean): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookieName(), remembered ? "1" : "0", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: 10 * 60,
  });
}

/** Reads and expires the short-lived OAuth preference bridge cookie. */
export async function takePendingScheduleSessionPreference(): Promise<boolean> {
  const cookieStore = await cookies();
  const name = cookieName();
  const remembered = cookieStore.get(name)?.value === "1";
  cookieStore.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    expires: new Date(0),
  });
  return remembered;
}
