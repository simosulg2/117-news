"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { signIn } from "@/auth";
import { requireScheduleUser } from "@/features/auth/server/require-schedule-user";
import {
  SCHEDULE_PATH,
  SCHEDULE_SIGN_IN_PATH,
} from "@/features/auth/server/schedule-auth-policy";
import {
  createScheduleInvite,
  isScheduleInviteAvailable,
  listScheduleInvites,
  revokeScheduleInvite,
  type ScheduleInviteSummary,
} from "@/features/auth/server/schedule-invite-store.server";

import { setPendingScheduleInviteToken } from "./schedule-invite-cookie.server";

export type InviteActionResult =
  | Readonly<{ ok: true; id: string; token: string; expiresAt: string }>
  | Readonly<{ ok: false; error: "forbidden" | "unavailable" }>;

/** Accepts an invite code via POST, then carries it through OAuth in an HttpOnly cookie. */
export async function beginInvitedGithubSignIn(formData: FormData): Promise<void> {
  const value = formData.get("invite");
  const token = typeof value === "string" ? value.trim() : "";
  let available = false;
  try {
    available = await isScheduleInviteAvailable(token);
  } catch {
    redirect(`${SCHEDULE_SIGN_IN_PATH}?error=Configuration`);
  }
  if (!available) redirect(`${SCHEDULE_SIGN_IN_PATH}?error=InvalidInvite`);
  await setPendingScheduleInviteToken(token);
  await signIn("github", { redirectTo: SCHEDULE_PATH });
}

export async function createScheduleInviteAction(): Promise<InviteActionResult> {
  const user = await requireScheduleUser();
  if (user.developmentBypass || !user.id || !user.isAdmin) {
    return { ok: false, error: "forbidden" };
  }
  try {
    const invite = await createScheduleInvite(user.id);
    if (!invite) return { ok: false, error: "forbidden" };
    revalidatePath(SCHEDULE_PATH);
    return {
      ok: true,
      id: invite.id,
      token: invite.token,
      expiresAt: invite.expiresAt,
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export async function listScheduleInvitesForAdmin(): Promise<ScheduleInviteSummary[]> {
  const user = await requireScheduleUser();
  if (user.developmentBypass || !user.id || !user.isAdmin) return [];
  try {
    return await listScheduleInvites(user.id);
  } catch {
    return [];
  }
}

export async function revokeScheduleInviteAction(inviteId: string): Promise<boolean> {
  const user = await requireScheduleUser();
  if (user.developmentBypass || !user.id || !user.isAdmin) return false;
  try {
    const revoked = await revokeScheduleInvite(user.id, inviteId);
    if (revoked) revalidatePath(SCHEDULE_PATH);
    return revoked;
  } catch {
    return false;
  }
}
