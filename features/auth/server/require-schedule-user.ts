import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import {
  getScheduleAuthState,
  SCHEDULE_SIGN_IN_PATH,
} from "@/features/auth/server/schedule-auth-policy";

export type ScheduleUser = Readonly<{
  name: string | null;
  email: string | null;
  image: string | null;
  developmentBypass: boolean;
}>;

const DEVELOPMENT_USER: ScheduleUser = {
  name: "Arendusrežiim",
  email: null,
  image: null,
  developmentBypass: true,
};

function signInDestination(error?: "AccessDenied" | "Configuration"): string {
  const parameters = new URLSearchParams({ callbackUrl: "/ajakava" });
  if (error) parameters.set("error", error);
  return `${SCHEDULE_SIGN_IN_PATH}?${parameters.toString()}`;
}

export async function requireScheduleUser(): Promise<ScheduleUser> {
  const state = getScheduleAuthState(process.env);

  if (state.developmentBypass) return DEVELOPMENT_USER;
  if (!state.configured) redirect(signInDestination("Configuration"));

  let session: Session | null;
  try {
    session = await auth();
  } catch {
    redirect(signInDestination("Configuration"));
  }

  const user = session?.user;
  if (!user) redirect(signInDestination());
  if (!user.scheduleAccess) {
    redirect(signInDestination("AccessDenied"));
  }

  return {
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    developmentBypass: false,
  };
}
