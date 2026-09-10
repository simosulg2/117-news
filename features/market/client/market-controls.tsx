type MarketControlsProps = {
  minimumGap: number;
  tradeAmount: number;
  showAll: boolean;
  refreshing: boolean;
  onMinimumGapChange: (value: number) => void;
  onTradeAmountChange: (value: number) => void;
  onShowAllChange: (value: boolean) => void;
  onRefresh: () => void;
};

export function MarketControls({
  minimumGap,
  tradeAmount,
  showAll,
  refreshing,
  onMinimumGapChange,
  onTradeAmountChange,
  onShowAllChange,
  onRefresh,
}: MarketControlsProps) {
  return (
    <section className="grid gap-px border border-[#aebcc6] bg-[#aebcc6] dark:border-[#29485f] dark:bg-[#29485f] sm:grid-cols-[minmax(9rem,0.8fr)_minmax(11rem,1fr)_minmax(10rem,1fr)_auto]">
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

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="min-h-12 bg-[#163f73] px-5 text-xs font-black uppercase tracking-[0.08em] text-white outline-none hover:bg-[#245fae] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal disabled:cursor-wait disabled:opacity-60 dark:bg-[#245fae] dark:hover:bg-[#2f76cc]"
      >
        {refreshing ? "Uuendan…" : "Uuenda hindu"}
      </button>
    </section>
  );
}
