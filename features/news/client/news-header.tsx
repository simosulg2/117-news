import type { RefObject } from "react";

import { deskClockFormatter } from "@/features/news/client/news-formatters";
import { PrimaryHeader } from "@/features/shell/client/primary-header";
import { CATEGORIES, type Category, type NewsResponse } from "@/lib/types";

type NewsHeaderProps = {
  category: Category;
  data: NewsResponse | null;
  now: Date | null;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  theme: "light" | "dark";
  onCategoryChange: (category: Category) => void;
  onClearSearch: () => void;
  onQueryChange: (query: string) => void;
  onToggleTheme: () => void;
};

export function NewsHeader({
  category,
  data,
  now,
  query,
  searchRef,
  theme,
  onCategoryChange,
  onClearSearch,
  onQueryChange,
  onToggleTheme,
}: NewsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
      <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
        <PrimaryHeader
          activeSection="news"
          tagline="Eesti uudisvoog"
          statusText={data ? `${data.sources.loaded}/${data.sources.total} voogu` : "—/5 voogu"}
          statusHealthy={Boolean(data && data.sources.loaded === data.sources.total)}
          statusAriaLive
          clockText={now ? `${deskClockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />

        <div className="flex flex-col border-x border-[#263d50] sm:flex-row sm:items-stretch">
          <nav aria-label="Uudiste kategooriad" className="no-scrollbar flex overflow-x-auto border-b border-[#263d50] sm:border-b-0 sm:border-r">
            {CATEGORIES.map((item) => {
              const active = item === category;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onCategoryChange(item)}
                  aria-pressed={active}
                  className={`min-h-10 shrink-0 border-r border-[#263d50] px-4 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:last:border-r-0 ${
                    active ? "bg-signal text-[#07131f]" : "text-[#a9b7c2] hover:bg-[#102538] hover:text-white"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </nav>

          <div className="relative flex min-h-10 flex-1 items-stretch bg-[#0b1b29] sm:min-w-[18rem]">
            <label
              htmlFor="news-search"
              className="flex items-center border-r border-[#263d50] px-3 text-[13px] font-semibold text-signal"
            >
              Otsing
            </label>
            <input
              id="news-search"
              ref={searchRef}
              type="search"
              aria-keyshortcuts="/"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Pealkiri, allikas või märksõna"
              className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-[#8da1b0] focus:bg-[#06101a]"
            />
            {query ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="min-w-[5.5rem] border-l border-[#263d50] px-3 text-xs font-semibold text-[#8da1b0] outline-none hover:text-signal focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal"
                aria-label="Tühjenda otsing"
              >
                Tühjenda
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
