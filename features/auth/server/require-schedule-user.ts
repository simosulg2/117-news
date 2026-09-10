import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import {
  getScheduleAuthState,
  type PrivatePath,
  SCHEDULE_PATH,
  SCHEDULE_SIGN_IN_PATH,
} from "@/features/auth/server/schedule-auth-policy";
import { getScheduleUserAccessById } from "@/features/auth/server/schedule-user-store.server";

export type ScheduleUser = Readonly<{
  id: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin: boolean;
  developmentBypass: boolean;
}>;

const DEVELOPMENT_USER: ScheduleUser = {
  id: null,
  name: "Arendusrežiim",
  email: null,
  image: null,
  isAdmin: true,
  developmentBypass: true,
};

function signInDestination(
  callbackPath: PrivatePath,
  error?: "AccessDenied" | "Configuration",
): string {
  const parameters = new URLSearchParams({ callbackUrl: callbackPath });
  if (error) parameters.set("error", error);
  return `${SCHEDULE_SIGN_IN_PATH}?${parameters.toString()}`;
}

export async function requireScheduleUser(
  callbackPath: PrivatePath = SCHEDULE_PATH,
): Promise<ScheduleUser> {
  const state = getScheduleAuthState(process.env);

  if (state.developmentBypass) return DEVELOPMENT_USER;
  if (!state.configured) redirect(signInDestination(callbackPath, "Configuration"));

  let session: Session | null;
  try {
    session = await auth();
  } catch {
    redirect(signInDestination(callbackPath, "Configuration"));
  }

  const user = session?.user;
  if (!user) redirect(signInDestination(callbackPath));
  if (!user.scheduleAccess) {
    redirect(signInDestination(callbackPath, "AccessDenied"));
  }

  let access;
  try {
    access = await getScheduleUserAccessById(user.scheduleUserId);
  } catch {
    redirect(signInDestination(callbackPath, "Configuration"));
  }
  if (!access) redirect(signInDestination(callbackPath, "AccessDenied"));

  return {
    id: access.id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    isAdmin: access.isAdmin,
    developmentBypass: false,
  };
}
