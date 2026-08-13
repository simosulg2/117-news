"use client";

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";

import { NewsHeader } from "@/features/news/client/news-header";
import { NewsList } from "@/features/news/client/news-list";
import { NewsEmptyState, NewsErrorState, NewsLoadingState } from "@/features/news/client/news-states";
import { NewsToolbar } from "@/features/news/client/news-toolbar";
import { useNewsFeed } from "@/features/news/client/use-news-feed";
import { useNewsKeyboardNavigation } from "@/features/news/client/use-news-keyboard-navigation";
import { useReadHistory } from "@/features/news/client/use-read-history";
import { filterNewsItems } from "@/features/news/model/news-items";
import { useClock } from "@/features/shell/client/use-clock";
import { usePageTheme } from "@/features/shell/client/use-page-theme";
import { PageFooter } from "@/features/shell/client/page-footer";
import type { Category } from "@/lib/types";

export function NewsPortal() {
  const { data, error, refreshing, refreshError, refreshNews } = useNewsFeed();
  const { isItemRead, markItemRead, readCount, readStateLoaded, resetReadHistory } = useReadHistory();
  const [category, setCategory] = useState<Category>("Kõik");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock();
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(
    () => filterNewsItems(data, category, deferredQuery),
    [category, data, deferredQuery],
  );
  const visibleItemIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems]);
  const registerHeadline = useNewsKeyboardNavigation(visibleItemIds, searchRef);

  const focusSearchAfterUpdate = useCallback(() => {
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    focusSearchAfterUpdate();
  }, [focusSearchAfterUpdate]);

  const resetFilters = useCallback(() => {
    setCategory("Kõik");
    setQuery("");
    focusSearchAfterUpdate();
  }, [focusSearchAfterUpdate]);

  return (
    <div className="min-h-screen">
      <a
        href="#newswire"
        className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white"
      >
        Liigu uudisvoogu
      </a>

      <NewsHeader
        category={category}
        data={data}
        now={now}
        query={query}
        searchRef={searchRef}
        theme={theme}
        onCategoryChange={setCategory}
        onClearSearch={clearSearch}
        onQueryChange={setQuery}
        onToggleTheme={toggleTheme}
      />

      <main id="newswire" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-10 pt-4 outline-none sm:px-5 lg:px-7">
        <NewsToolbar
          category={category}
          data={data}
          filteredCount={filteredItems.length}
          hasDeferredQuery={Boolean(deferredQuery.trim())}
          now={now}
          readCount={readCount}
          readStateLoaded={readStateLoaded}
          refreshError={refreshError}
          refreshing={refreshing}
          error={error}
          onRefresh={refreshNews}
          onResetReadHistory={resetReadHistory}
        />

        {data && data.sources.failed.length > 0 && (
          <div className="mb-3 border border-[#7964bd] bg-[#b6a3ff]/10 px-3 py-2 text-xs text-[#60459f] dark:text-[#c7b8ff]">
            <b>Mõni uudisvoog pole hetkel saadaval:</b> {data.sources.failed.join(", ")}. Näitame ülejäänud uudiseid.
          </div>
        )}

        {!data && !error && <NewsLoadingState />}
        {error && <NewsErrorState error={error} onRetry={refreshNews} />}
        {data && filteredItems.length === 0 && (
          <NewsEmptyState hasQuery={Boolean(query)} onReset={resetFilters} />
        )}
        {data && filteredItems.length > 0 && (
          <NewsList
            items={filteredItems}
            nowMs={now?.getTime() ?? Date.now()}
            isRead={isItemRead}
            onOpen={markItemRead}
            registerHeadline={registerHeadline}
          />
        )}
      </main>

      <PageFooter label="Eesti uudisvoog">
        Allikad: ERR ja Postimees · Lingid avanevad algallikas
      </PageFooter>
    </div>
  );
}
