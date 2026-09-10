"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { MarketControls } from "@/features/market/client/market-controls";
import { MarketPageFrame } from "@/features/market/client/market-page-frame";
import { MarketSummary } from "@/features/market/client/market-summary";
import { MarketTable } from "@/features/market/client/market-table";
import { formatEur, formatTallinnTime } from "@/features/market/client/market-formatters";
import { useMarketPreferences } from "@/features/market/client/use-market-preferences";
import { getMarketWindowState } from "@/features/market/model/market-opportunities";
import { buildMarketRows } from "@/features/market/model/market-view-model";
import { useClock } from "@/features/shell/client/use-clock";
import { usePageTheme } from "@/features/shell/client/use-page-theme";
import type { MarketRefreshResult, MarketSnapshot } from "@/lib/market-types";

type MarketPortalProps = {
  initialSnapshot: MarketSnapshot;
  canSignOut: boolean;
  onSignOut: () => Promise<void>;
  onRefresh: () => Promise<MarketRefreshResult>;
};

export function MarketPortal({
  initialSnapshot,
  canSignOut,
  onSignOut,
  onRefresh,
}: MarketPortalProps) {
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock(15_000);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const {
    minimumGap,
    tradeAmount,
    showAll,
    query,
    directionFilter,
    sortOrder,
    setMinimumGap,
    setTradeAmount,
    setShowAll,
    setQuery,
    setDirectionFilter,
    setSortOrder,
    resetFilters,
  } = useMarketPreferences();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const windowState = now ? getMarketWindowState(now) : snapshot.window;

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const result = await onRefresh();
      if (result.ok) {
        setSnapshot(result.snapshot);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }, [onRefresh]);

  useEffect(() => {
    if (windowState !== "open") return;
    refresh();
    const interval = globalThis.window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60_000);
    return () => globalThis.window.clearInterval(interval);
  }, [refresh, windowState]);

  const rows = useMemo(
    () => buildMarketRows(snapshot, tradeAmount, minimumGap, windowState),
    [minimumGap, snapshot, tradeAmount, windowState],
  );

  return (
    <MarketPageFrame
      theme={theme}
      now={now}
      availableCount={snapshot.availableCount}
      instrumentCount={snapshot.instrumentCount}
      canSignOut={canSignOut}
      onSignOut={onSignOut}
      onToggleTheme={toggleTheme}
    >
      <main id="market-main" tabIndex={-1} className="mx-auto w-full max-w-[96rem] flex-1 px-3 pb-12 pt-5 outline-none sm:px-5 lg:px-7">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Xetra → USA hinnavahe</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#172634] dark:text-[#edf4f8] sm:text-3xl">Olümpiaadi turuskanner</h1>
          </div>
          <p className="text-[10px] font-semibold text-[#617786] dark:text-[#7890a2]">
            Viimane laadimine {formatTallinnTime(snapshot.fetchedAt)} · värskes aknas automaatselt iga 60 s
          </p>
        </div>

        <MarketSummary snapshot={snapshot} rows={rows} window={windowState} />
        <div className="mt-4">
          <MarketControls
            minimumGap={minimumGap}
            tradeAmount={tradeAmount}
            showAll={showAll}
            query={query}
            directionFilter={directionFilter}
            sortOrder={sortOrder}
            refreshing={refreshing}
            onMinimumGapChange={(value) => setMinimumGap(Math.min(25, Math.max(0, Number.isFinite(value) ? value : 0)))}
            onTradeAmountChange={(value) => setTradeAmount(Math.min(100_000, Math.max(100, Number.isFinite(value) ? value : 100)))}
            onShowAllChange={setShowAll}
            onQueryChange={setQuery}
            onDirectionFilterChange={setDirectionFilter}
            onSortOrderChange={setSortOrder}
            onResetFilters={resetFilters}
            onRefresh={refresh}
          />
        </div>
        {error && <p role="alert" className="mt-3 border border-[#a84f3b] bg-[#f9e3dd] px-3 py-2 text-xs font-semibold text-[#713525] dark:bg-[#341d1a] dark:text-[#f0ad9d]">{error}</p>}

        <section className="mt-4" aria-labelledby="market-results-title">
          <div className="mb-2 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
            <div>
              <h2 id="market-results-title" className="text-base font-black text-[#172634] dark:text-[#edf4f8]">Hinnapaarid</h2>
              <p className="text-[10px] text-[#617786] dark:text-[#7890a2]">Positiivne vahe = ostusuund. Negatiivne vahe = müügisuund ainult juba omatud varale.</p>
            </div>
            <p className="text-[10px] text-[#617786] dark:text-[#7890a2]">* Neto = hinnavahe {formatEur(tradeAmount)} pealt − kaks × 2,50 € tehingutasu.</p>
          </div>
          <MarketTable
            rows={rows}
            showAll={showAll}
            tradeAmount={tradeAmount}
            query={query}
            directionFilter={directionFilter}
            sortOrder={sortOrder}
          />
        </section>

        <details className="mt-5 border border-[#aebcc6] bg-white dark:border-[#29485f] dark:bg-[#0b1b29]">
          <summary className="cursor-pointer px-4 py-3 text-xs font-black text-[#29485f] outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#b8c8d3]">Kuidas arvutus töötab</summary>
          <div className="border-t border-[#d2dce2] px-4 py-4 text-xs leading-6 text-[#526878] dark:border-[#20394d] dark:text-[#8da1b0]">
            <p>Võistluse võrdlushind on Yahoo viimane mitte-tühi Xetra ühe minuti tehing rangelt enne 17.30 Euroopa/Berliini aja järgi. Eraldi kuvatav „oksjon” on Yahoo ametlikum sulgemisoksjoni hind ja seda signaali arvutusse ei segata.</p>
            <p className="mt-2">USA hind jagatakse jooksva EUR/USD kursiga; HSBC puhul arvestatakse, et üks USA ADR vastab viiele lihtaktsiale. Tugev signaal peab ületama sinu piirmäära, automaatse 0,20 protsendipunkti andmevaru ja kahe tehingu 5 € kogutasu.</p>
            <p className="mt-2 font-semibold text-[#67460f] dark:text-[#efc983]">See ei ole riskivaba arbitraaž: USA liikumine võib enne järgmist hindamist pöörduda. Kontrolli enne orderit rea Investing.com linki. Skanner ei logi võistlusse sisse ega saada tehinguid.</p>
          </div>
        </details>
      </main>
    </MarketPageFrame>
  );
}
