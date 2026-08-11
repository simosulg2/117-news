"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { CATEGORIES, type Category, type NewsItem, type NewsResponse } from "@/lib/types";

const deskDateFormatter = new Intl.DateTimeFormat("et-EE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Tallinn",
});

const itemTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

const exactDateFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

const deskClockFormatter = new Intl.DateTimeFormat("et-EE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

const numberFormatter = new Intl.NumberFormat("et-EE");

function relativeTime(value: string, nowMs = Date.now()): string {
  const elapsedMinutes = Math.max(0, Math.round((nowMs - Date.parse(value)) / 60_000));
  if (elapsedMinutes < 1) return "praegu";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours} t`;
  return `${Math.floor(hours / 24)} p`;
}

function formatItemTime(value: string): string {
  return itemTimeFormatter.format(new Date(value)).replace(",", "");
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("et-EE").normalize("NFKD").replace(/\p{M}/gu, "");
}

function categoryColor(category: NewsItem["category"]): string {
  switch (category) {
    case "Eesti":
      return "text-[#2268bd] dark:text-[#6eb1ff]";
    case "Majandus":
      return "text-[#087663] dark:text-[#55d6b2]";
    case "Sport":
      return "text-[#6f56b3] dark:text-[#b6a3ff]";
  }
}

function CategoryLabel({ category }: { category: NewsItem["category"] }) {
  return (
    <span className={`inline-flex border-l-2 border-current pl-2 text-xs font-semibold leading-4 ${categoryColor(category)}`}>
      {category}
    </span>
  );
}

function ArticleRow({ item, nowMs }: { item: NewsItem; nowMs: number }) {
  return (
    <li>
      <article>
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer external"
          className="terminal-row group relative grid min-h-[5.25rem] grid-cols-1 gap-1.5 border-b border-[#bccbd6] px-2 py-3 outline-none transition-colors hover:bg-[#4f8cff]/[0.07] focus-visible:bg-[#4f8cff]/[0.1] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#24394a] md:grid-cols-[7.5rem_7.5rem_minmax(0,1fr)_5rem] md:gap-x-4 md:py-3"
          aria-label={`${item.title} — ERR, avaneb uuel vahelehel`}
        >
          <div className="flex items-center gap-3 md:hidden">
            <CategoryLabel category={item.category} />
            <span className="text-[11px] font-semibold text-[#526878] dark:text-[#8da1b0]">
              {item.source}
            </span>
            {item.publishedAt && (
              <time
                dateTime={item.publishedAt}
                title={exactDateFormatter.format(new Date(item.publishedAt))}
                className="text-[11px] tabular-nums text-[#526878] dark:text-[#8da1b0]"
              >
                {formatItemTime(item.publishedAt)} / {relativeTime(item.publishedAt, nowMs)}
              </time>
            )}
          </div>

          {item.publishedAt ? (
            <time
              dateTime={item.publishedAt}
              title={exactDateFormatter.format(new Date(item.publishedAt))}
              className="hidden whitespace-nowrap text-[11px] tabular-nums text-[#495e6d] dark:text-[#a9b7c2] md:block"
            >
              {formatItemTime(item.publishedAt)} <span className="text-[#526878] dark:text-[#8da1b0]">{relativeTime(item.publishedAt, nowMs)}</span>
            </time>
          ) : (
            <span className="hidden text-[11px] text-[#526878] dark:text-[#8da1b0] md:block">—</span>
          )}

          <div className="hidden md:block">
            <CategoryLabel category={item.category} />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-bold leading-[1.35] text-[#101a24] transition-colors group-hover:text-[#245fae] dark:text-[#edf4f8] dark:group-hover:text-[#7db0ff]">
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-1 line-clamp-2 max-w-5xl text-xs leading-[1.45] text-[#526878] dark:text-[#8da1b0] md:line-clamp-1">
                {item.summary}
              </p>
            )}
          </div>

          <span className="hidden text-[11px] font-semibold text-[#495e6d] dark:text-[#a9b7c2] md:block">
            {item.source}
          </span>

        </a>
      </article>
    </li>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function LoadingState() {
  return (
    <div role="status" aria-label="Uudiste laadimine" className="border-t border-[#9fb2c0] dark:border-[#35536a]">
      <span className="sr-only">Laadin värskeid uudiseid…</span>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
        <div
          key={item}
          className="grid min-h-[5.25rem] grid-cols-1 gap-2 border-b border-[#bccbd6] px-2 py-3 dark:border-[#24394a] md:grid-cols-[7.5rem_7.5rem_minmax(0,1fr)_5rem] md:gap-x-4"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="hidden h-3 w-16 md:block" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-3xl" />
            <Skeleton className="h-3 w-3/4 max-w-2xl" />
          </div>
          <Skeleton className="hidden h-3 w-8 md:block" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasQuery, onReset }: { hasQuery: boolean; onReset: () => void }) {
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

export function NewsPortal() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [category, setCategory] = useState<Category>("Kõik");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [now, setNow] = useState<Date | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    async function loadNews() {
      try {
        const response = await fetch("/api/news", { signal: controller.signal });
        if (!response.ok) throw new Error("Uudiste laadimine ebaõnnestus.");
        setData((await response.json()) as NewsResponse);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Uudisvoogudega ei saadud ühendust. Kontrolli ühendust ja proovi uuesti.");
      }
    }

    void loadNews();
    return () => controller.abort();
  }, [retryKey]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("117-theme", next);
      return next;
    });
  }, []);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const needle = normalizeSearch(deferredQuery.trim());

    return data.items.filter((item) => {
      if (category !== "Kõik" && item.category !== category) return false;
      if (!needle) return true;
      return normalizeSearch(`${item.title} ${item.summary} ${item.category}`).includes(needle);
    });
  }, [category, data, deferredQuery]);

  const resetFilters = useCallback(() => {
    setCategory("Kõik");
    setQuery("");
  }, []);

  return (
    <div className="min-h-screen">
      <a
        href="#newswire"
        className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white"
      >
        Liigu uudisvoogu
      </a>

      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[#263d50]">
            <a href="#" className="flex items-center gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-signal" aria-label="117.ee avaleht">
              <span className="block size-10 shrink-0" aria-hidden="true">
                <img src="/117.png" alt="" className="size-full object-contain" />
              </span>
              <span className="hidden text-xs font-medium text-[#8da1b0] sm:inline">ERR-i uudisvoog</span>
            </a>

            <div className="flex items-center gap-3 text-[11px]">
              <span className="hidden text-[#8da1b0] sm:inline">
                <b aria-live="polite" className={data && data.sources.loaded === data.sources.total ? "text-[#55d6b2]" : "text-[#b6a3ff]"}>{data ? `${data.sources.loaded}/${data.sources.total} voogu` : "—/3 voogu"}</b>
                <span aria-hidden="true" className="ml-3 tabular-nums text-[#8295a4]">{now ? `${deskClockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}</span>
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="min-h-8 border border-[#3b5870] px-2.5 font-bold text-[#c7d5df] outline-none hover:border-signal hover:text-[#7db0ff] focus-visible:ring-1 focus-visible:ring-signal"
                aria-label={theme === "dark" ? "Kasuta heledat kujundust" : "Kasuta tumedat kujundust"}
              >
                {theme === "dark" ? "Hele" : "Tume"}
              </button>
            </div>
          </div>

          <div className="flex flex-col border-x border-[#263d50] sm:flex-row sm:items-stretch">
            <nav aria-label="Uudiste kategooriad" className="no-scrollbar flex overflow-x-auto border-b border-[#263d50] sm:border-b-0 sm:border-r">
              {CATEGORIES.map((item) => {
                const active = item === category;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    aria-pressed={active}
                    className={`min-h-10 shrink-0 border-r border-[#263d50] px-4 text-xs font-semibold outline-none transition-colors last:border-r-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal ${
                      active ? "bg-signal text-[#07131f]" : "text-[#a9b7c2] hover:bg-[#102538] hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </nav>

            <label className="relative flex min-h-10 flex-1 items-stretch bg-[#0b1b29] sm:min-w-[18rem]">
              <span className="flex items-center border-r border-[#263d50] px-3 text-xs font-semibold text-signal">Otsing</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pealkiri või märksõna"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-[#8da1b0] focus:bg-[#06101a]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="min-w-[5.5rem] border-l border-[#263d50] px-3 text-xs font-semibold text-[#8da1b0] outline-none hover:text-signal focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal"
                  aria-label="Tühjenda otsing"
                >
                  Tühjenda
                </button>
              ) : null}
            </label>
          </div>
        </div>
      </header>

      <main id="newswire" className="mx-auto max-w-[96rem] px-3 pb-10 pt-4 sm:px-5 lg:px-7">
        <div className="mb-3 grid gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 text-[11px] font-semibold text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2] sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="font-bold text-[#245fae] dark:text-signal">117 uudislaud</h1>
            <span>{now ? deskDateFormatter.format(now) : "--.--.----"}</span>
            <span>Eesti uudised</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
            <span aria-live="polite">{data ? `${numberFormatter.format(filteredItems.length)} uudist` : "— uudist"}</span>
            <span>Teema: {category}</span>
            <span>Uuendatud: {data ? relativeTime(data.updatedAt, now?.getTime()) : "—"}</span>
          </div>
        </div>

        {data && data.sources.failed.length > 0 && (
          <div className="mb-3 border border-[#7964bd] bg-[#b6a3ff]/10 px-3 py-2 text-xs text-[#60459f] dark:text-[#c7b8ff]">
            <b>Mõni uudisvoog pole hetkel saadaval:</b> {data.sources.failed.join(", ")}. Näitame ülejäänud uudiseid.
          </div>
        )}

        {!data && !error && <LoadingState />}

        {error && (
          <div role="alert" className="flex min-h-28 flex-col justify-center gap-3 border-y border-[#9d2f2f] bg-[#b42318]/5 px-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#b42318] dark:text-[#ff6b63]">Uudiste laadimine ebaõnnestus</p>
              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-xs font-semibold text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]"
            >
              Proovi uuesti
            </button>
          </div>
        )}

        {data && filteredItems.length === 0 && <EmptyState hasQuery={Boolean(query)} onReset={resetFilters} />}

        {data && filteredItems.length > 0 && (
          <section aria-label="Uudiste nimekiri">
            <div className="hidden grid-cols-[7.5rem_7.5rem_minmax(0,1fr)_5rem] gap-x-4 border-y border-[#9fb2c0] bg-[#d5e0e7] px-2 py-1.5 text-[10px] font-semibold text-[#4b6170] dark:border-[#35536a] dark:bg-[#102538] dark:text-[#7890a2] md:grid">
              <span>Avaldatud</span>
              <span>Teema</span>
              <span>Uudis</span>
              <span>Allikas</span>
            </div>
            <ul>
              {filteredItems.map((item) => (
                <ArticleRow key={item.id} item={item} nowMs={now?.getTime() ?? Date.now()} />
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-[#9fb2c0] bg-[#dfe8ee] dark:border-[#35536a] dark:bg-[#0b1b29]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-2 px-3 py-3 text-[10px] text-[#526878] dark:text-[#7890a2] sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-7">
          <span><b className="text-[#245fae] dark:text-signal">117.ee</b> · ERR-i uudisvoog</span>
          <span>Uudiste sisu © ERR · Lingid avanevad algallikas</span>
        </div>
      </footer>
    </div>
  );
}
