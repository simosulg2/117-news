"use client";

import { useEffect, useMemo, useState } from "react";

import { useClock } from "../../shell/client/use-clock";
import { usePageTheme } from "../../shell/client/use-page-theme";
import { PoliticalFinanceMethodology } from "./political-finance-methodology";
import { PoliticalFinanceOverview } from "./political-finance-overview";
import { PoliticalFinancePageFrame } from "./political-finance-page-frame";
import { PoliticalFinancePartyDetail } from "./political-finance-party-detail";
import { PoliticalFinanceRecords } from "./political-finance-records";
import { PoliticalFinanceLoading, PoliticalFinanceStatus } from "./political-finance-status";
import { usePoliticalFinance } from "./use-political-finance";

export function PoliticalFinancePortal() {
  const feed = usePoliticalFinance();
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock();
  const [selectedPartyId, setSelectedPartyId] = useState("");

  useEffect(() => {
    if (!feed.data?.parties.length) return;
    setSelectedPartyId((current) => feed.data?.parties.some((party) => party.id === current)
      ? current
      : feed.data!.parties[0].id);
  }, [feed.data]);

  const selectedParty = useMemo(
    () => feed.data?.parties.find((party) => party.id === selectedPartyId) ?? feed.data?.parties[0] ?? null,
    [feed.data, selectedPartyId],
  );

  return (
    <PoliticalFinancePageFrame theme={theme} now={now} healthy={feed.data?.source.status === "ok"} onToggleTheme={toggleTheme}>
      <main id="political-finance-main" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-12 pt-4 outline-none sm:px-5 lg:px-7">
        <PoliticalFinanceStatus data={feed.data} error={feed.error} refreshing={feed.refreshing} onRefresh={feed.refresh} />
        {!feed.data && !feed.error && <PoliticalFinanceLoading />}
        {feed.data && selectedParty && (
          <>
            <PoliticalFinanceOverview data={feed.data} selectedPartyId={selectedParty.id} onSelectParty={setSelectedPartyId} />
            <PoliticalFinancePartyDetail party={selectedParty} />
            <PoliticalFinanceRecords key={selectedParty.id} party={selectedParty} availablePeriods={feed.data.availablePeriods} />
            <PoliticalFinanceMethodology source={feed.data.source} />
          </>
        )}
      </main>
    </PoliticalFinancePageFrame>
  );
}
