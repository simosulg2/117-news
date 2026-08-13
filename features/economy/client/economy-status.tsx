type EconomyStatusProps = {
  error: string | null;
  refreshError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
};

export function EconomyStatus({ error, refreshError, refreshing, onRefresh, onRetry }: EconomyStatusProps) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 text-xs font-semibold text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2]">
        <span>Majandusnäitajad · võrreldavad perioodid · ametlik allikas</span>
        <button type="button" onClick={onRefresh} disabled={refreshing} className="min-h-8 px-2 font-semibold text-[#245fae] underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#174a8d] focus-visible:ring-1 focus-visible:ring-signal disabled:cursor-wait disabled:opacity-60 dark:text-[#7db0ff]">
          {refreshing ? "Värskendan…" : "Uuenda"}
        </button>
      </div>
      {refreshError && <div role="status" className="mb-3 border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">{refreshError}</div>}
      {error && (
        <div role="alert" className="mb-3 flex flex-col gap-3 border border-[#9d2f2f] bg-[#b42318]/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-bold text-[#b42318] dark:text-[#ff6b63]">Majandusandmete laadimine ebaõnnestus</p><p className="mt-1 text-xs text-[#526878] dark:text-[#8da1b0]">{error}</p></div>
          <button type="button" onClick={onRetry} className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-xs font-semibold text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]">Proovi uuesti</button>
        </div>
      )}
    </>
  );
}

export function EconomyLoadingState() {
  return (
    <div aria-label="Laadin majandusandmeid">
      <div className="mb-4 h-36 border border-[#9fb2c0] bg-[#f4f7f9] p-4 dark:border-[#35536a] dark:bg-[#0a1926]"><div className="skeleton h-5 w-64" /><div className="mt-6 grid grid-cols-4 gap-4"><div className="skeleton h-12" /><div className="skeleton h-12" /><div className="skeleton h-12" /><div className="skeleton h-12" /></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((value) => <div key={value} className="h-96 border border-[#9fb2c0] bg-[#f4f7f9] p-4 dark:border-[#35536a] dark:bg-[#0a1926]"><div className="skeleton h-4 w-36" /><div className="skeleton mt-8 h-10 w-44" /><div className="skeleton mt-10 h-16 w-full" /></div>)}</div>
    </div>
  );
}
