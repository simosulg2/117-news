"use client";

import { Check, Clock3, Moon, RefreshCw, Search, Sun, X } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { CATEGORIES, type Category, type NewsItem, type NewsResponse } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("et-EE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Tallinn",
});

const exactDateFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Tallinn",
});

const numberFormatter = new Intl.NumberFormat("et-EE");

function relativeTime(value: string): string {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (elapsedMinutes < 1) return "just praegu";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min tagasi`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours} t tagasi`;
  const days = Math.floor(hours / 24);
  return `${days} p tagasi`;
}

function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("et-EE").normalize("NFKD").replace(/\p{M}/gu, "");
}

function categoryStyle(category: NewsItem["category"]): string {
  switch (category) {
    case "Eesti":
      return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200";
    case "Majandus":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200";
    case "Kultuur":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-400/20 dark:bg-fuchsia-400/10 dark:text-fuchsia-200";
    case "Sport":
      return "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200";
    case "Teadus":
      return "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200";
    case "Arvamus":
      return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200";
    case "Tehnoloogia":
      return "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200";
    case "Kultuur/Ühiskond":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300";
  }
}

function CategoryTag({ category }: { category: NewsItem["category"] }) {
  return (
    <span className={`inline-flex min-h-7 w-fit items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold leading-none ${categoryStyle(category)}`}>
      {category}
    </span>
  );
}

function ArticleTime({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  if (!item.publishedAt) return null;

  return (
    <time
      dateTime={item.publishedAt}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-zinc-500 dark:text-zinc-400 ${compact ? "text-[11px]" : "text-xs"}`}
      title={exactDateFormatter.format(new Date(item.publishedAt))}
    >
      <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
      {relativeTime(item.publishedAt)}
    </time>
  );
}

function ArticleRow({ item }: { item: NewsItem }) {
  return (
    <li>
      <article>
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer external"
          className="group -mx-3 grid gap-3 border-b border-black/10 px-3 py-4 outline-none ring-inset ring-blue-500 transition-colors hover:bg-blue-600/[0.045] focus-visible:ring-2 dark:border-white/10 dark:hover:bg-blue-400/[0.055] sm:py-5 md:grid-cols-[8.5rem_minmax(0,1fr)_8.5rem] md:gap-x-6 lg:-mx-5 lg:px-5"
          aria-label={`${item.title} — ${item.source}, avaneb uuel vahelehel`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:block">
            <CategoryTag category={item.category} />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-300 md:hidden">
              {item.source}
            </span>
            <span className="md:hidden">
              <ArticleTime item={item} compact />
            </span>
          </div>

          <div className="min-w-0">
            <h2 className="text-balance text-lg font-extrabold leading-[1.22] tracking-[-0.02em] text-ink transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300 sm:text-[1.35rem]">
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-1.5 line-clamp-2 max-w-4xl text-sm leading-5 text-zinc-600 dark:text-zinc-400 sm:leading-6">
                {item.summary}
              </p>
            )}
          </div>

          <div className="hidden flex-col items-end gap-2 text-right md:flex">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-700 dark:text-zinc-200">
              {item.source}
            </span>
            <ArticleTime item={item} />
          </div>
        </a>
      </article>
    </li>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

function LoadingState() {
  return (
    <div role="status" aria-label="Uudiste laadimine" className="border-t border-black/10 dark:border-white/10">
      <span className="sr-only">Laadin värskeid uudiseid…</span>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
        <div
          key={item}
          className="grid gap-3 border-b border-black/10 py-5 dark:border-white/10 md:grid-cols-[8.5rem_minmax(0,1fr)_8.5rem] md:gap-x-6"
        >
          <Skeleton className="h-7 w-20 rounded-full" />
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-full max-w-3xl" />
            <Skeleton className="h-5 w-4/5 max-w-2xl" />
            <Skeleton className="h-3.5 w-3/5 max-w-xl" />
          </div>
          <div className="hidden space-y-2 md:block">
            <Skeleton className="ml-auto h-3 w-16" />
            <Skeleton className="ml-auto h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasQuery, onReset }: { hasQuery: boolean; onReset: () => void }) {
  return (
    <div className="grid min-h-[22rem] place-items-center border-y border-dashed border-black/15 px-6 text-center dark:border-white/15">
      <div>
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          <Search aria-hidden="true" className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-xl font-extrabold">Tulemusi ei leitud</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {hasQuery ? "Proovi teist märksõna või vaata kõiki teemasid." : "Selles kategoorias pole praegu uudiseid."}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-5 min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white outline-none ring-blue-500 hover:bg-blue-700 focus-visible:ring-4 dark:bg-white dark:text-ink dark:hover:bg-blue-200"
        >
          Näita kõiki uudiseid
        </button>
      </div>
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
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    async function loadNews() {
      try {
        const response = await fetch("/api/news", { signal: controller.signal });
        if (!response.ok) throw new Error("Uudiste laadimine ebaõnnestus.");
        const nextData = (await response.json()) as NewsResponse;
        setData(nextData);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Uudiste laadimine ebaõnnestus. Kontrolli ühendust ja proovi uuesti.");
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
      return normalizeSearch(`${item.title} ${item.summary} ${item.category} ${item.source}`).includes(needle);
    });
  }, [category, data, deferredQuery]);

  const resetFilters = useCallback(() => {
    setCategory("Kõik");
    setQuery("");
  }, []);

  const updatedLabel = data ? relativeTime(data.updatedAt) : "uuendamisel";

  return (
    <div className="min-h-screen">
      <a
        href="#uudised"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white outline-none focus:translate-y-0 focus:ring-4 focus:ring-blue-300"
      >
        Liigu uudiste juurde
      </a>

      <header className="sticky top-0 z-50 border-b border-black/10 bg-paper/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#0c0f12]/90">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
          <div className="flex min-h-[4.25rem] items-center justify-between gap-4 border-b border-black/10 py-2.5 dark:border-white/10">
            <a href="#" className="group flex items-center gap-3 rounded-lg outline-none ring-blue-500 focus-visible:ring-4" aria-label="117.ee avaleht">
              <span className="font-display text-[1.85rem] font-black leading-none tracking-[-0.06em]">
                <span className="text-blue-700 dark:text-blue-400">117</span>.ee
              </span>
              <span className="hidden border-l border-black/15 pl-3 text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] text-zinc-500 dark:border-white/15 dark:text-zinc-400 sm:block">
                uudised<br />selges vaates
              </span>
            </a>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 md:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {data ? `${data.sources.loaded}/${data.sources.total} uudisvoogu` : "Uudisvood"}
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-zinc-700 outline-none ring-blue-500 transition hover:border-blue-400 hover:text-blue-700 focus-visible:ring-4 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:text-blue-300"
                aria-label={theme === "dark" ? "Kasuta heledat kujundust" : "Kasuta tumedat kujundust"}
              >
                {theme === "dark" ? <Sun aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" /> : <Moon aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Uudiste kategooriad" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
              {CATEGORIES.map((item) => {
                const active = item === category;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    aria-pressed={active}
                    className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-bold outline-none ring-blue-500 transition focus-visible:ring-4 ${
                      active
                        ? "bg-ink text-white dark:bg-white dark:text-ink"
                        : "text-zinc-600 hover:bg-black/[0.055] hover:text-ink dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </nav>

            <label className="relative block w-full shrink-0 lg:w-[21rem]">
              <span className="sr-only">Otsi uudiseid</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-zinc-500" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Otsi uudiseid või allikat…"
                className="h-11 w-full rounded-full border border-black/10 bg-white pl-11 pr-20 text-sm font-medium outline-none ring-blue-500 placeholder:text-zinc-400 hover:border-black/20 focus:border-blue-400 focus:ring-4 dark:border-white/10 dark:bg-white/[0.06] dark:placeholder:text-zinc-500 dark:hover:border-white/20"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-zinc-500 outline-none hover:bg-black/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Tühjenda otsing"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-black/10 bg-zinc-100 px-2 py-0.5 font-sans text-[11px] font-bold text-zinc-500 dark:border-white/10 dark:bg-white/[0.06] sm:block">
                  /
                </kbd>
              )}
            </label>
          </div>
        </div>
      </header>

      <main id="uudised" className="mx-auto max-w-[84rem] px-4 pb-14 pt-7 sm:px-6 sm:pt-9 lg:px-10 lg:pb-20">
        <div className="mb-5 flex flex-col justify-between gap-4 border-b border-black/10 pb-5 dark:border-white/10 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">
              {dateFormatter.format(new Date())}
            </p>
            <h1 className="text-balance font-display text-4xl font-black leading-[0.98] tracking-[-0.05em] sm:text-5xl">
              Uudised, selgelt.
            </h1>
          </div>
          <div aria-live="polite" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            {data && (
              <span className="font-semibold text-ink dark:text-white">
                {numberFormatter.format(filteredItems.length)} lugu
              </span>
            )}
            <span>Uuendatud {updatedLabel}</span>
          </div>
        </div>

        {data && data.sources.failed.length > 0 && (
          <div className="mb-5 flex items-start gap-3 border-y border-amber-300 bg-amber-50/70 px-3 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Näitame {data.sources.loaded} allika värskeid uudiseid. Mõni voog ({data.sources.failed.join(", ")}) on ajutiselt kättesaamatu.
            </p>
          </div>
        )}

        {!data && !error && <LoadingState />}

        {error && (
          <div role="alert" className="grid min-h-[25rem] place-items-center border-y border-red-300 bg-red-50/45 px-6 text-center dark:border-red-500/30 dark:bg-red-500/[0.06]">
            <div>
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                <RefreshCw aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-xl font-extrabold">Uudised ei jõudnud kohale</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">{error}</p>
              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white outline-none ring-blue-500 hover:bg-blue-700 focus-visible:ring-4 dark:bg-white dark:text-ink dark:hover:bg-blue-200"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" /> Proovi uuesti
              </button>
            </div>
          </div>
        )}

        {data && filteredItems.length === 0 && <EmptyState hasQuery={Boolean(query)} onReset={resetFilters} />}

        {data && filteredItems.length > 0 && (
          <section aria-label="Uudiste nimekiri">
            <ul className="border-t border-black/10 dark:border-white/10">
              {filteredItems.map((item) => (
                <ArticleRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto flex max-w-[84rem] flex-col gap-4 px-4 py-7 text-xs leading-5 text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-black tracking-[-0.04em] text-ink dark:text-white">
              <span className="text-blue-700 dark:text-blue-400">117</span>.ee
            </span>
            <span>Selgem tee oluliste uudisteni.</span>
          </div>
          <p>Uudiste sisu kuulub algallikatele. Lingid avanevad algallika veebis.</p>
        </div>
      </footer>
    </div>
  );
}
