export function NewsLoadingState() {
  return (
    <div role="status" aria-label="Uudiste laadimine" className="border-t border-[#9fb2c0] dark:border-[#35536a]">
      <span className="sr-only">Laadin värskeid uudiseid…</span>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
        <div
          key={item}
          className="grid min-h-[5.25rem] grid-cols-1 gap-2 border-b border-[#bccbd6] px-2 py-3 dark:border-[#24394a] md:grid-cols-[9rem_8rem_minmax(0,1fr)_11rem] md:gap-x-5"
        >
          <div className="skeleton h-3 w-24" />
          <div className="skeleton hidden h-3 w-16 md:block" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-full max-w-3xl" />
            <div className="skeleton h-3 w-3/4 max-w-2xl" />
          </div>
          <div className="skeleton hidden h-3 w-24 md:block" />
        </div>
      ))}
    </div>
  );
}

export function NewsEmptyState({ hasQuery, onReset }: { hasQuery: boolean; onReset: () => void }) {
  return (
    <div className="flex min-h-24 flex-col justify-center gap-3 border-y border-[#9fb2c0] px-3 py-4 dark:border-[#35536a] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Tulemusi ei leitud</p>
        <p className="mt-1.5 text-xs text-[#526878] dark:text-[#8da1b0]">
          {hasQuery ? "Muuda päringut või lähtesta filtrid." : "Valitud sektoris pole praegu uudiseid."}
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="min-h-10 w-fit border border-[#29485f] bg-[#0b1b29] px-4 text-xs font-semibold text-white outline-none hover:border-signal hover:text-[#7db0ff] focus-visible:ring-2 focus-visible:ring-signal dark:border-[#4b6a80]"
      >
        Tühjenda filtrid
      </button>
    </div>
  );
}

export function NewsErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-28 flex-col justify-center gap-3 border-y border-[#9d2f2f] bg-[#b42318]/5 px-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-[#b42318] dark:text-[#ff6b63]">Uudiste laadimine ebaõnnestus</p>
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">{error}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-xs font-semibold text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]"
      >
        Proovi uuesti
      </button>
    </div>
  );
}
