import type { Metadata } from "next";

import { MarketPortal } from "@/components/market-portal";
import { signOutOfSchedule } from "@/features/auth/server/auth-actions";
import { requireScheduleUser } from "@/features/auth/server/require-schedule-user";
import { refreshMarketAction } from "@/features/market/server/market-actions";
import { loadMarketSnapshot } from "@/features/market/server/market-source.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Turuskanner · 117.ee",
  description: "Privaatne Xetra ja USA turuhindade võrdlus.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function MarketPage() {
  const user = await requireScheduleUser("/turg");
  const snapshot = await loadMarketSnapshot();
  return (
    <MarketPortal
      initialSnapshot={snapshot}
      canSignOut={!user.developmentBypass}
      onSignOut={signOutOfSchedule}
      onRefresh={refreshMarketAction}
    />
  );
}
