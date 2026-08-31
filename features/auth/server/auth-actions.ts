"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { signOut } from "@/auth";
import {
  isAuthJsSessionCookieName,
  SCHEDULE_SIGN_IN_PATH,
} from "@/features/auth/server/schedule-auth-policy";

export async function signOutOfSchedule(): Promise<void> {
  try {
    await signOut({ redirect: false });
  } catch {
    // The explicit cookie cleanup below remains available if Auth.js is unavailable.
  }

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (!isAuthJsSessionCookieName(cookie.name)) continue;
    cookieStore.set(cookie.name, "", {
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: cookie.name.startsWith("__Secure-"),
    });
  }
  redirect(SCHEDULE_SIGN_IN_PATH);
}
