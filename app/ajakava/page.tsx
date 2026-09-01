import type { Metadata } from "next";

import { SchedulePortal } from "@/components/schedule-portal";
import { signOutOfSchedule } from "@/features/auth/server/auth-actions";
import { requireScheduleUser } from "@/features/auth/server/require-schedule-user";
import {
  loadScheduleData,
  ScheduleDataUnavailableError,
} from "@/features/schedule/server/schedule-source.server";
import type { ScheduleData } from "@/lib/schedule-types";

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

  let data: ScheduleData | null = null;
  try {
    data = await loadScheduleData();
  } catch (error) {
    if (!(error instanceof ScheduleDataUnavailableError)) throw error;
  }

  return (
    <SchedulePortal
      data={data}
      canSignOut={!user.developmentBypass}
      onSignOut={signOutOfSchedule}
    />
  );
}
