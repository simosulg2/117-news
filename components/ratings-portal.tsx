"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { MethodologyPanel } from "@/features/ratings/client/methodology-panel";
import { PartyStandings } from "@/features/ratings/client/party-standings";
import { ProjectionBoard } from "@/features/ratings/client/projection-board";
import { RatingsPageFrame } from "@/features/ratings/client/ratings-page-frame";
import {
  ProjectionUnavailable,
  RatingsLoadingState,
  RatingsStatus,
} from "@/features/ratings/client/ratings-status";
import { useRatingsFeed } from "@/features/ratings/client/use-ratings-feed";
import {
  buildRatingsViewModel,
  calculateRatingsProjection,
  validCoalitionSelection,
} from "@/features/ratings/model/ratings-view-model";
import { useClock } from "@/features/shell/client/use-clock";
import { usePageTheme } from "@/features/shell/client/use-page-theme";

export function RatingsPortal() {
  const feed = useRatingsFeed();
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock();
  const [showMinorParties, setShowMinorParties] = useState(false);
  const [selectedCoalitionIds, setSelectedCoalitionIds] = useState<Set<string>>(new Set());

  const projection = useMemo(
    () => feed.data ? calculateRatingsProjection(feed.data.poll.parties) : null,
    [feed.data],
  );
  const viewModel = useMemo(
    () => feed.data && projection
      ? buildRatingsViewModel(feed.data.poll.parties, projection, selectedCoalitionIds)
      : null,
    [feed.data, projection, selectedCoalitionIds],
  );

  const toggleCoalitionParty = useCallback((id: string) => {
    setSelectedCoalitionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!viewModel) return;
    setSelectedCoalitionIds((current) => {
      const next = validCoalitionSelection(current, viewModel.projectedParties);
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
      return next;
    });
  }, [viewModel?.projectedParties]);

  const nowMs = now?.getTime() ?? Date.now();

  return (
    <RatingsPageFrame
      theme={theme}
      now={now}
      hasData={feed.data !== null}
      onToggleTheme={toggleTheme}
    >
      <main id="ratings-main" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-12 pt-4 outline-none sm:px-5 lg:px-7">
        <RatingsStatus
          data={feed.data}
          error={feed.error}
          refreshError={feed.refreshError}
          refreshing={feed.refreshing}
          nowMs={nowMs}
          onRefresh={feed.refresh}
          onRetry={feed.retry}
        />

        {!feed.data && !feed.error && <RatingsLoadingState />}
        {feed.data && !projection && <ProjectionUnavailable />}

        {feed.data && projection && viewModel && (
          <>
            <ProjectionBoard
              poll={feed.data.poll}
              viewModel={viewModel}
              selectedPartyIds={selectedCoalitionIds}
              onToggleParty={toggleCoalitionParty}
              onClearCoalition={() => setSelectedCoalitionIds(new Set())}
            />
            <PartyStandings
              previousWave={feed.data.poll.previousWave}
              primaryParties={viewModel.primaryTableParties}
              minorParties={viewModel.minorTableParties}
              projectedParties={viewModel.projectedParties}
              showMinorParties={showMinorParties}
              onToggleMinorParties={() => setShowMinorParties((current) => !current)}
            />
            <MethodologyPanel data={feed.data} />
          </>
        )}
      </main>
    </RatingsPageFrame>
  );
}
