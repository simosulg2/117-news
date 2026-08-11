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
      return "text-[#2f83d1] dark:text-[#62b2ff]";
    case "Majandus":
      return "text-[#087f4d] dark:text-[#46d990]";
    case "Sport":
      return "text-[#b45400] dark:text-[#ffad42]";
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
          className="terminal-row group relative grid min-h-[5.25rem] grid-cols-1 gap-1.5 border-b border-[#c7c7c0] px-2 py-3 outline-none transition-colors hover:bg-[#f4a62a]/[0.07] focus-visible:bg-[#f4a62a]/[0.09] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#282c30] md:grid-cols-[7.5rem_7.5rem_minmax(0,1fr)_5rem] md:gap-x-4 md:py-3"
          aria-label={`${item.title} — ERR, avaneb uuel vahelehel`}
        >
          <div className="flex items-center gap-3 md:hidden">
            <CategoryCode category={item.category} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#656560] dark:text-[#8e959c]">
              {item.source}
            </span>
            {item.publishedAt && (
              <time
                dateTime={item.publishedAt}
                title={exactDateFormatter.format(new Date(item.publishedAt))}
                className="font-mono text-[10px] tabular-nums text-[#656560] dark:text-[#8e959c]"
              >
                {formatItemTime(item.publishedAt)} / {relativeTime(item.publishedAt, nowMs)}
              </time>
            )}
          </div>

          {item.publishedAt ? (
            <time
              dateTime={item.publishedAt}
              title={exactDateFormatter.format(new Date(item.publishedAt))}
              className="hidden whitespace-nowrap font-mono text-[10px] tabular-nums text-[#595954] dark:text-[#a7adb2] md:block"
            >
              {formatItemTime(item.publishedAt)} <span className="text-[#898984] dark:text-[#656c72]">{relativeTime(item.publishedAt, nowMs)}</span>
            </time>
          ) : (
            <span className="hidden font-mono text-[10px] text-[#898984] md:block">—</span>
          )}

          <div className="hidden md:block">
            <CategoryCode category={item.category} />
          </div>

          <div className="min-w-0">
            <h2 className="text-[15px] font-bold leading-[1.25] tracking-[-0.012em] text-[#111214] transition-colors group-hover:text-[#8a4700] dark:text-[#f0f2f3] dark:group-hover:text-[#ffad42] sm:text-base">
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-1 line-clamp-2 max-w-5xl text-xs leading-[1.45] text-[#5c5c57] dark:text-[#9299a0] md:line-clamp-1">
                {item.summary}
              </p>
            )}
          </div>

          <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#595954] dark:text-[#a7adb2] md:block">
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
    <div role="status" aria-label="Uudiste laadimine" className="border-t border-[#aaa9a1] dark:border-[#3a3f44]">
      <span className="sr-only">Laadin värskeid uudiseid…</span>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
        <div
          key={item}
          className="grid min-h-[5.25rem] grid-cols-1 gap-2 border-b border-[#c7c7c0] px-2 py-3 dark:border-[#282c30] md:grid-cols-[7.5rem_7.5rem_minmax(0,1fr)_5rem] md:gap-x-4"
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
    <div className="flex min-h-24 flex-col justify-center gap-3 border-y border-[#aaa9a1] px-3 py-4 font-mono dark:border-[#3a3f44] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[11px] font-bold tracking-[0.14em] text-signal">[ 0 VASTET ] <span className="ml-2 text-[#222522] dark:text-[#e0e3e5]">TULEMUSI EI LEITUD</span></p>
        <p className="mt-1.5 text-xs text-[#62625d] dark:text-[#9299a0]">
          {hasQuery ? "Muuda päringut või lähtesta filtrid." : "Valitud sektoris pole praegu uudiseid."}
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="min-h-10 w-fit border border-[#282b2e] bg-[#121416] px-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white outline-none hover:border-signal hover:text-[#f4a62a] focus-visible:ring-2 focus-visible:ring-signal dark:border-[#5b6065]"
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

      <header className="sticky top-0 z-50 border-b border-[#1a1c1e] bg-[#0b0c0d] text-[#e8eaeb] shadow-[0_1px_0_#f4a62a]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <div className="flex min-h-11 items-center justify-between gap-4 border-b border-[#292c2f]">
            <a href="#" className="flex items-baseline gap-2 font-mono outline-none focus-visible:ring-1 focus-visible:ring-signal" aria-label="117.ee avaleht">
              <span className="bg-signal px-1.5 py-0.5 text-lg font-black leading-none tracking-[-0.08em] text-black">117</span>
              <span className="text-sm font-bold tracking-[-0.03em]">.EE</span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-[#8e959c] sm:inline">Uudisvoog</span>
            </a>

            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em]">
              <span aria-live="polite" className="hidden text-[#8e959c] sm:inline">
                Vood <b className={data && data.sources.loaded === data.sources.total ? "text-[#47d78b]" : "text-[#f4a62a]"}>{data ? `${data.sources.loaded}/${data.sources.total}` : "—/3"}</b>
                <span className="ml-3 text-[#697077]">{now ? `${deskClockFormatter.format(now)} EE` : "--:--:-- EE"}</span>
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="min-h-8 border border-[#4a4f54] px-2.5 font-bold text-[#c9cdd0] outline-none hover:border-signal hover:text-[#f4a62a] focus-visible:ring-1 focus-visible:ring-signal"
                aria-label={theme === "dark" ? "Kasuta heledat kujundust" : "Kasuta tumedat kujundust"}
              >
                {theme === "dark" ? "Hele" : "Tume"}
              </button>
            </div>
          </div>

          <div className="flex flex-col border-x border-[#292c2f] sm:flex-row sm:items-stretch">
            <nav aria-label="Uudiste kategooriad" className="no-scrollbar flex overflow-x-auto border-b border-[#292c2f] sm:border-b-0 sm:border-r">
              {CATEGORIES.map((item) => {
                const active = item === category;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    aria-pressed={active}
                    className={`min-h-10 shrink-0 border-r border-[#292c2f] px-4 font-mono text-[11px] font-bold uppercase tracking-[0.08em] outline-none transition-colors last:border-r-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal ${
                      active ? "bg-signal text-black" : "text-[#aeb3b7] hover:bg-[#1a1c1e] hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </nav>

            <label className="relative flex min-h-10 flex-1 items-stretch bg-[#111315] sm:min-w-[18rem]">
              <span className="flex items-center border-r border-[#292c2f] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-signal">Otsing</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pealkiri või märksõna"
                className="min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-white outline-none placeholder:text-[#62686d] focus:bg-black/30"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="min-w-11 border-l border-[#292c2f] px-2 font-mono text-[10px] font-bold uppercase text-[#8e959c] outline-none hover:text-signal focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal"
                  aria-label="Tühjenda otsing"
                >
                  CLR
                </button>
              ) : (
                <kbd className="flex items-center border-l border-[#292c2f] px-3 font-mono text-[10px] text-[#62686d]">/</kbd>
              )}
            </label>
          </div>
        </div>
      </header>

      <main id="newswire" className="mx-auto max-w-[96rem] px-3 pb-10 pt-4 sm:px-5 lg:px-7">
        <div className="mb-3 grid gap-2 border-y border-[#aaa9a1] bg-[#deded8] px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#353532] dark:border-[#3a3f44] dark:bg-[#121416] dark:text-[#a7adb2] sm:grid-cols-[1fr_auto] sm:items-center">
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
          <div className="mb-3 border border-[#b36200] bg-[#f4a62a]/10 px-3 py-2 font-mono text-[11px] text-[#754000] dark:text-[#f4a62a]">
            <b>[ PIIRATUD ]</b> MAAS: {data.sources.failed.join(", ").toUpperCase()} — NÄITAME ÜLEJÄÄNUD VOOGE
          </div>
        )}

        {!data && !error && <LoadingState />}

        {error && (
          <div role="alert" className="flex min-h-28 flex-col justify-center gap-3 border-y border-[#9d2f2f] bg-[#b42318]/5 px-3 py-4 font-mono sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] text-[#d9473f]">[ VOO VIGA ] <span className="ml-2 text-[#202326] dark:text-[#eef0f1]">ÜHENDUS KATKESTATUD</span></p>
              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-[#62625d] dark:text-[#9299a0]">{error}</p>
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
            <div className="hidden grid-cols-[7.5rem_7.5rem_minmax(0,1fr)_5rem] gap-x-4 border-y border-[#aaa9a1] bg-[#d0d0c9] px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#555550] dark:border-[#3a3f44] dark:bg-[#17191b] dark:text-[#7e858b] md:grid">
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

      <footer className="border-t border-[#aaa9a1] bg-[#deded8] dark:border-[#3a3f44] dark:bg-[#111315]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-2 px-3 py-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[#656560] dark:text-[#747b81] sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-7">
          <span><b className="text-signal">117.EE</b> / ERR UUDISTERMINAL</span>
          <span>Uudiste sisu © ERR · Lingid avanevad algallikas</span>
        </div>
      </footer>
    </div>
  );
}
