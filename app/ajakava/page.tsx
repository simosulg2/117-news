import type { Metadata } from "next";

import { SchedulePortal } from "@/components/schedule-portal";
import { signOutOfSchedule } from "@/features/auth/server/auth-actions";
import { requireScheduleUser } from "@/features/auth/server/require-schedule-user";
import {
  createScheduleInviteAction,
  listScheduleInvitesForAdmin,
  revokeScheduleInviteAction,
} from "@/features/auth/server/schedule-invite-actions";
import { saveScheduleAction } from "@/features/schedule/server/schedule-actions";
import {
  loadScheduleData,
  ScheduleDataUnavailableError,
  type UserScheduleDocument,
} from "@/features/schedule/server/schedule-source.server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ajakava · 117.ee",
  description: "Privaatne päeva- ja nädalaplaan.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function SchedulePage() {
  const user = await requireScheduleUser();

  let document: UserScheduleDocument | null = null;
  try {
    document = await loadScheduleData(user);
  } catch (error) {
    if (!(error instanceof ScheduleDataUnavailableError)) throw error;
  }
  const invites = user.isAdmin && !user.developmentBypass
    ? await listScheduleInvitesForAdmin()
    : [];

  return (
    <SchedulePortal
      data={document?.data ?? null}
      revision={document?.revision ?? null}
      canSignOut={!user.developmentBypass}
      canInvite={user.isAdmin && !user.developmentBypass}
      onSignOut={signOutOfSchedule}
      onSave={saveScheduleAction}
      onCreateInvite={createScheduleInviteAction}
      initialInvites={invites}
      onRevokeInvite={revokeScheduleInviteAction}
    />
  );
}
