const OFFICIAL_RADAR_FALLBACK = "https://www.ilmateenistus.ee/ilm/ilmavaatlused/radar/";

export function RadarLoading({ className }: { className: string }) {
  return (
    <div className={`border border-[#bccbd6] bg-[#e4ebf0] p-4 dark:border-[#294154] dark:bg-[#0d1c29] ${className}`}>
      <div className="skeleton h-[20rem] w-full sm:h-[26rem]" />
      <p className="mt-3 text-xs font-semibold text-[#526878] dark:text-[#8da1b0]">Laadin radaripilte…</p>
    </div>
  );
}

export function RadarUnavailable({
  className,
  error,
  onRetry,
}: {
  className: string;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className={`border border-[#c96c6c] bg-[#fff1f1] p-5 dark:border-[#7b3e45] dark:bg-[#25151a] ${className}`}>
      <p className="text-sm font-bold text-[#8c1f2c] dark:text-[#ff9ca7]">{error ?? "Radar pole praegu saadaval."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className="border border-[#8c1f2c] px-3 py-1.5 text-xs font-bold text-[#8c1f2c] hover:bg-[#8c1f2c]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8c1f2c] dark:border-[#ff9ca7] dark:text-[#ff9ca7]">
          Proovi uuesti
        </button>
        <a href={OFFICIAL_RADAR_FALLBACK} target="_blank" rel="noopener noreferrer external" className="border border-[#90a4b2] px-3 py-1.5 text-xs font-bold text-[#245fae] hover:bg-[#4f8cff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8cff] dark:border-[#3b5870] dark:text-[#7db0ff]">
          Ava ametlik radar ↗
        </a>
      </div>
    </div>
  );
}
