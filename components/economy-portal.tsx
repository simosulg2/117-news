"use client";

import { EconomyDashboard } from "@/features/economy/client/economy-dashboard";
import { EconomyPageFrame } from "@/features/economy/client/economy-page-frame";
import { EconomyLoadingState, EconomyStatus } from "@/features/economy/client/economy-status";
import { useEconomyFeed } from "@/features/economy/client/use-economy-feed";
import { useClock } from "@/features/shell/client/use-clock";
import { usePageTheme } from "@/features/shell/client/use-page-theme";

export function EconomyPortal() {
  const feed = useEconomyFeed();
  const now = useClock();
  const { theme, toggleTheme } = usePageTheme();
  const source = feed.data?.sources[0];
  const statusText = source ? `${source.successfulGroups}/${source.totalGroups} gruppi` : "—/6 gruppi";
  return (
    <EconomyPageFrame
      theme={theme}
      now={now}
      statusText={statusText}
      statusHealthy={feed.data?.status === "ok"}
      onToggleTheme={toggleTheme}
    >
      <main id="economy-main" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-12 pt-4 outline-none sm:px-5 lg:px-7">
        <EconomyStatus
          error={feed.error}
          refreshError={feed.refreshError}
          refreshing={feed.refreshing}
          onRefresh={feed.refresh}
          onRetry={feed.retry}
        />
        {!feed.data && !feed.error && <EconomyLoadingState />}
        {feed.data && <EconomyDashboard data={feed.data} />}
      </main>
    </EconomyPageFrame>
  );
}
