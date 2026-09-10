import type {
  MarketDirectionFilter,
  MarketSortOrder,
} from "../model/market-view-model";

type MarketControlsProps = {
  minimumGap: number;
  tradeAmount: number;
  showAll: boolean;
  query: string;
  directionFilter: MarketDirectionFilter;
  sortOrder: MarketSortOrder;
  refreshing: boolean;
  onMinimumGapChange: (value: number) => void;
  onTradeAmountChange: (value: number) => void;
  onShowAllChange: (value: boolean) => void;
  onQueryChange: (value: string) => void;
  onDirectionFilterChange: (value: MarketDirectionFilter) => void;
  onSortOrderChange: (value: MarketSortOrder) => void;
  onResetFilters: () => void;
  onRefresh: () => void;
};

export function MarketControls({
  minimumGap,
  tradeAmount,
  showAll,
  query,
  directionFilter,
  sortOrder,
  refreshing,
  onMinimumGapChange,
  onTradeAmountChange,
  onShowAllChange,
  onQueryChange,
  onDirectionFilterChange,
  onSortOrderChange,
  onResetFilters,
  onRefresh,
}: MarketControlsProps) {
  const activeFilterCount = Number(Boolean(query.trim()))
    + Number(directionFilter !== "all")
    + Number(sortOrder !== "absolute-gap");

  return (
    <section className="grid gap-px border border-[#aebcc6] bg-[#aebcc6] dark:border-[#29485f] dark:bg-[#29485f] sm:grid-cols-2 lg:grid-cols-[minmax(8rem,0.7fr)_minmax(9rem,0.8fr)_minmax(10rem,1fr)_auto_auto]">
      <label className="bg-white px-3 py-2 dark:bg-[#0b1b29]">
        <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">Min erinevus</span>
        <span className="mt-1 flex items-center gap-1">
          <input
            type="number"
            min="0"
            max="25"
            step="0.1"
            value={minimumGap}
            onChange={(event) => onMinimumGapChange(Number(event.target.value))}
            className="w-20 bg-transparent text-sm font-black tabular-nums text-[#172634] outline-none focus:ring-1 focus:ring-signal dark:text-[#edf4f8]"
          />
          <span className="text-xs font-bold text-[#617786] dark:text-[#8da1b0]">%</span>
        </span>
      </label>

      <label className="bg-white px-3 py-2 dark:bg-[#0b1b29]">
        <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">Tehingumaht</span>
        <span className="mt-1 flex items-center gap-1">
          <input
            type="number"
            min="100"
            max="100000"
            step="100"
            value={tradeAmount}
            onChange={(event) => onTradeAmountChange(Number(event.target.value))}
            className="w-24 bg-transparent text-sm font-black tabular-nums text-[#172634] outline-none focus:ring-1 focus:ring-signal dark:text-[#edf4f8]"
          />
          <span className="text-xs font-bold text-[#617786] dark:text-[#8da1b0]">€</span>
        </span>
      </label>

      <label className="flex cursor-pointer items-center gap-2 bg-white px-3 py-2 text-xs font-bold text-[#40596b] dark:bg-[#0b1b29] dark:text-[#a9b7c2]">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(event) => onShowAllChange(event.target.checked)}
          className="size-4 accent-[#245fae]"
        />
        Näita kõiki instrumente
      </label>

      <details className="group relative bg-white dark:bg-[#0b1b29]">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-xs font-black uppercase tracking-[0.08em] text-[#29485f] outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#b8c8d3]">
          Filtrid
          {activeFilterCount > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#245fae] text-[9px] text-white">
              {activeFilterCount}
            </span>
          )}
        </summary>
        <div className="border-t border-[#d2dce2] bg-white p-3 dark:border-[#20394d] dark:bg-[#0b1b29] sm:absolute sm:right-0 sm:top-full sm:z-30 sm:mt-px sm:w-80 sm:border sm:border-[#aebcc6] sm:shadow-xl sm:dark:border-[#29485f]">
          <label className="block">
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">Otsi</span>
            <input
              type="search"
              value={query}
              maxLength={80}
              placeholder="Nimi või sümbol"
              onChange={(event) => onQueryChange(event.target.value)}
              className="mt-1 min-h-10 w-full border border-[#aebcc6] bg-white px-3 text-xs font-semibold text-[#172634] outline-none placeholder:text-[#8b9ba6] focus:border-[#245fae] focus:ring-1 focus:ring-[#245fae] dark:border-[#35536a] dark:bg-[#102538] dark:text-[#edf4f8]"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">Suund / seis</span>
              <select
                value={directionFilter}
                onChange={(event) => onDirectionFilterChange(event.target.value as MarketDirectionFilter)}
                className="mt-1 min-h-10 w-full border border-[#aebcc6] bg-white px-2 text-xs font-bold text-[#172634] outline-none focus:border-[#245fae] focus:ring-1 focus:ring-[#245fae] dark:border-[#35536a] dark:bg-[#102538] dark:text-[#edf4f8]"
              >
                <option value="all">Kõik</option>
                <option value="buy">Ostusuund</option>
                <option value="sell">Müügisuund</option>
                <option value="reliable">Ainult värsked</option>
              </select>
            </label>
            <label>
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#617786] dark:text-[#7890a2]">Järjestus</span>
              <select
                value={sortOrder}
                onChange={(event) => onSortOrderChange(event.target.value as MarketSortOrder)}
                className="mt-1 min-h-10 w-full border border-[#aebcc6] bg-white px-2 text-xs font-bold text-[#172634] outline-none focus:border-[#245fae] focus:ring-1 focus:ring-[#245fae] dark:border-[#35536a] dark:bg-[#102538] dark:text-[#edf4f8]"
              >
                <option value="absolute-gap">Suurim erinevus</option>
                <option value="buy-gap">Tugevaim ost</option>
                <option value="sell-gap">Tugevaim müük</option>
                <option value="freshest">Värskeim USA hind</option>
                <option value="name">Nimi A–Z</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={onResetFilters}
            disabled={activeFilterCount === 0}
            className="mt-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#245fae] underline underline-offset-2 disabled:cursor-default disabled:opacity-40 dark:text-[#7db0ff]"
          >
            Lähtesta filtrid
          </button>
        </div>
      </details>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="min-h-12 bg-[#163f73] px-5 text-xs font-black uppercase tracking-[0.08em] text-white outline-none hover:bg-[#245fae] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal disabled:cursor-wait disabled:opacity-60 dark:bg-[#245fae] dark:hover:bg-[#2f76cc] sm:col-span-2 lg:col-span-1"
      >
        {refreshing ? "Uuendan…" : "Uuenda hindu"}
      </button>
    </section>
  );
}
