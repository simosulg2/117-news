import { deskDateFormatter, numberFormatter } from "@/features/news/client/news-formatters";
import { relativeNewsTime } from "@/features/news/model/news-items";
import type { Category, NewsResponse } from "@/lib/types";

type NewsToolbarProps = {
  category: Category;
  data: NewsResponse | null;
  filteredCount: number;
  hasDeferredQuery: boolean;
  now: Date | null;
  readCount: number;
  readStateLoaded: boolean;
  refreshError: string | null;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onResetReadHistory: () => void;
};

export function NewsToolbar({
  category,
  data,
  filteredCount,
  hasDeferredQuery,
  now,
  readCount,
  readStateLoaded,
  refreshError,
  refreshing,
  error,
  onRefresh,
  onResetReadHistory,
}: NewsToolbarProps) {
  return (
    <div className="mb-3 grid gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 text-xs font-semibold text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2] sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="font-bold text-[#245fae] dark:text-signal">117 uudislaud</h1>
        <span>{now ? deskDateFormatter.format(now) : "--.--.----"}</span>
        <span>Eesti uudised</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
        <span aria-live="polite">
          {data
            ? data.sources.failed.length === 0 && category === "Kõik" && !hasDeferredQuery && filteredCount === 117
              ? "117 värskeimat uudist"
              : `${numberFormatter.format(filteredCount)} uudist`
            : "— uudist"}
        </span>
        <span>Teema: {category}</span>
        <span>Uuendatud: {data ? relativeNewsTime(data.updatedAt, now?.getTime()) : "—"}</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || (!data && !error)}
          className="font-semibold text-[#4b6170] underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal disabled:cursor-wait disabled:no-underline disabled:opacity-60 dark:text-[#8da1b0] dark:hover:text-[#7db0ff]"
        >
          {refreshing ? "Värskendan…" : "Uuenda"}
        </button>
        {refreshError && (
          <span role="status" className="text-[#9d2733] dark:text-[#ff929d]">
            {refreshError}
          </span>
        )}
        {readStateLoaded && readCount > 0 && (
          <button
            type="button"
            onClick={onResetReadHistory}
            className="font-semibold text-[#4b6170] underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#8da1b0] dark:hover:text-[#7db0ff]"
            title={`${numberFormatter.format(readCount)} loetud artiklit selles brauseris`}
          >
            Taasta kõik lugemata
          </button>
        )}
      </div>
    </div>
  );
}
