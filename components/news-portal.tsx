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
  if (elapsedMinutes < 1) return "NÜÜD";
  if (elapsedMinutes < 60) return `${elapsedMinutes}M`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours}H`;
  return `${Math.floor(hours / 24)}P`;
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

function CategoryCode({ category }: { category: NewsItem["category"] }) {
  return (
    <span className={`font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${categoryColor(category)}`}>
      [{category}]
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
            <CategoryCode category={item.category} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#526878] dark:text-[#8da1b0]">
              {item.source}
            </span>
            {item.publishedAt && (
              <time
                dateTime={item.publishedAt}
                title={exactDateFormatter.format(new Date(item.publishedAt))}
                className="font-mono text-[10px] tabular-nums text-[#526878] dark:text-[#8da1b0]"
              >
                {formatItemTime(item.publishedAt)} / {relativeTime(item.publishedAt, nowMs)}
              </time>
            )}
          </div>

          {item.publishedAt ? (
            <time
              dateTime={item.publishedAt}
              title={exactDateFormatter.format(new Date(item.publishedAt))}
              className="hidden whitespace-nowrap font-mono text-[10px] tabular-nums text-[#495e6d] dark:text-[#a9b7c2] md:block"
            >
              {formatItemTime(item.publishedAt)} <span className="text-[#738795] dark:text-[#687f91]">{relativeTime(item.publishedAt, nowMs)}</span>
            </time>
          ) : (
            <span className="hidden font-mono text-[10px] text-[#738795] md:block">—</span>
          )}

          <div className="hidden md:block">
            <CategoryCode category={item.category} />
          </div>

          <div className="min-w-0">
            <h2 className="text-[15px] font-bold leading-[1.25] tracking-[-0.012em] text-[#101a24] transition-colors group-hover:text-[#245fae] dark:text-[#edf4f8] dark:group-hover:text-[#7db0ff] sm:text-base">
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-1 line-clamp-2 max-w-5xl text-xs leading-[1.45] text-[#526878] dark:text-[#8da1b0] md:line-clamp-1">
                {item.summary}
              </p>
            )}
          </div>

          <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#495e6d] dark:text-[#a9b7c2] md:block">
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
    <div className="flex min-h-24 flex-col justify-center gap-3 border-y border-[#9fb2c0] px-3 py-4 font-mono dark:border-[#35536a] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-signal">[ 0 VASTET ] <span className="ml-2 text-[#192630] dark:text-[#e5eef4]">TULEMUSI EI LEITUD</span></p>
        <p className="mt-1.5 text-xs text-[#526878] dark:text-[#8da1b0]">
          {hasQuery ? "Muuda päringut või lähtesta filtrid." : "Valitud sektoris pole praegu uudiseid."}
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="min-h-10 w-fit border border-[#29485f] bg-[#0b1b29] px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white outline-none hover:border-signal hover:text-[#7db0ff] focus-visible:ring-2 focus-visible:ring-signal dark:border-[#4b6a80]"
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
  const [theme, setTheme] = useState<"light" | "dark">("dark");
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
        className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 font-mono text-[11px] font-bold uppercase text-black outline-none focus:translate-y-0 focus:ring-2 focus:ring-white"
      >
        Liigu uudisvoogu
      </a>

      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[#263d50]">
            <a href="#" className="flex items-center gap-2.5 font-mono outline-none focus-visible:ring-1 focus-visible:ring-signal" aria-label="117.ee avaleht">
              <span className="block size-10 shrink-0" aria-hidden="true">
                <img src="/117.png" alt="" className="size-full object-contain" />
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-[#8da1b0] sm:inline">Uudisvoog</span>
            </a>

            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em]">
              <span aria-live="polite" className="hidden text-[#8da1b0] sm:inline">
                Vood <b className={data && data.sources.loaded === data.sources.total ? "text-[#55d6b2]" : "text-[#b6a3ff]"}>{data ? `${data.sources.loaded}/${data.sources.total}` : "—/3"}</b>
                <span className="ml-3 text-[#687f91]">{now ? `${deskClockFormatter.format(now)} EE` : "--:--:-- EE"}</span>
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
                    className={`min-h-10 shrink-0 border-r border-[#263d50] px-4 font-mono text-[11px] font-bold uppercase tracking-[0.08em] outline-none transition-colors last:border-r-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal ${
                      active ? "bg-signal text-white" : "text-[#a9b7c2] hover:bg-[#102538] hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </nav>

            <label className="relative flex min-h-10 flex-1 items-stretch bg-[#0b1b29] sm:min-w-[18rem]">
              <span className="flex items-center border-r border-[#263d50] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-signal">Otsing</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pealkiri või märksõna"
                className="min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-white outline-none placeholder:text-[#60788a] focus:bg-[#06101a]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="min-w-11 border-l border-[#263d50] px-2 font-mono text-[10px] font-bold uppercase text-[#8da1b0] outline-none hover:text-signal focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal"
                  aria-label="Tühjenda otsing"
                >
                  CLR
                </button>
              ) : (
                <kbd className="flex items-center border-l border-[#263d50] px-3 font-mono text-[10px] text-[#60788a]">/</kbd>
              )}
            </label>
          </div>
        </div>
      </header>

      <main id="newswire" className="mx-auto max-w-[96rem] px-3 pb-10 pt-4 sm:px-5 lg:px-7">
        <div className="mb-3 grid gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2] sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="text-signal">117 Uudislaud</h1>
            <span>{now ? deskDateFormatter.format(now).toUpperCase() : "--.--.----"}</span>
            <span>Piirkond: EE</span>
          </div>
          <div aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
            <span>Kirjeid: {data ? numberFormatter.format(filteredItems.length) : "—"}</span>
            <span>Teema: {category}</span>
            <span>Sync: {data ? relativeTime(data.updatedAt, now?.getTime()) : "—"}</span>
          </div>
        </div>

        {data && data.sources.failed.length > 0 && (
          <div className="mb-3 border border-[#7964bd] bg-[#b6a3ff]/10 px-3 py-2 font-mono text-[11px] text-[#60459f] dark:text-[#c7b8ff]">
            <b>[ PIIRATUD ]</b> MAAS: {data.sources.failed.join(", ").toUpperCase()} — NÄITAME ÜLEJÄÄNUD VOOGE
          </div>
        )}

        {!data && !error && <LoadingState />}

        {error && (
          <div role="alert" className="flex min-h-28 flex-col justify-center gap-3 border-y border-[#9d2f2f] bg-[#b42318]/5 px-3 py-4 font-mono sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] text-[#d9473f]">[ VOO VIGA ] <span className="ml-2 text-[#202326] dark:text-[#eef0f1]">ÜHENDUS KATKESTATUD</span></p>
              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setRetryKey((value) => value + 1)}
              className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]"
            >
              Proovi uuesti
            </button>
          </div>
        )}

        {data && filteredItems.length === 0 && <EmptyState hasQuery={Boolean(query)} onReset={resetFilters} />}

        {data && filteredItems.length > 0 && (
          <section aria-label="Uudiste nimekiri">
            <div className="hidden grid-cols-[7.5rem_7.5rem_minmax(0,1fr)_5rem] gap-x-4 border-y border-[#9fb2c0] bg-[#d5e0e7] px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#4b6170] dark:border-[#35536a] dark:bg-[#102538] dark:text-[#7890a2] md:grid">
              <span>Aeg / Vanus</span>
              <span>Sektor</span>
              <span>Pealkiri / Kokkuvõte</span>
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
        <div className="mx-auto flex max-w-[96rem] flex-col gap-2 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[#526878] dark:text-[#7890a2] sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-7">
          <span><b className="text-signal">117.EE</b> / ERR UUDISTERMINAL</span>
          <span>Uudiste sisu © ERR · Lingid avanevad algallikas</span>
        </div>
      </footer>
    </div>
  );
}
