"use client";

import {
  ArrowUpRight,
  Check,
  Clock3,
  Moon,
  RefreshCw,
  Search,
  Sun,
  X,
} from "lucide-react";
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
      return "bg-blue-600 text-white dark:bg-blue-500 dark:text-white";
    case "Majandus":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200";
    case "Kultuur":
      return "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-500/20 dark:text-fuchsia-200";
    case "Sport":
      return "bg-orange-100 text-orange-950 dark:bg-orange-500/20 dark:text-orange-200";
    case "English":
      return "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200";
    default:
      return "bg-zinc-200 text-zinc-800 dark:bg-white/10 dark:text-zinc-200";
  }
}

function ImageFallback({ category }: { category: NewsItem["category"] }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden bg-[#dce5f3] dark:bg-[#182131]" aria-hidden="true">
      <span className="absolute -right-5 -top-8 select-none font-display text-[8rem] font-black leading-none text-blue-600/10 dark:text-blue-300/10">
        117
      </span>
      <span className="relative rounded-full border border-blue-900/15 bg-white/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-950 backdrop-blur dark:border-white/10 dark:bg-black/15 dark:text-blue-100">
        {category}
      </span>
    </div>
  );
}

function ArticleImage({ item, eager = false }: { item: NewsItem; eager?: boolean }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative h-full min-h-[10rem] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
      {!item.imageUrl || failed ? (
        <ImageFallback category={item.category} />
      ) : (
        // RSS image hosts vary, so a native image keeps all valid ERR media URLs usable.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.025]"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          decoding={eager ? "sync" : "async"}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-70" />
    </div>
  );
}

function ArticleMeta({ item, inverted = false }: { item: NewsItem; inverted?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
      <span className={`rounded-full px-2.5 py-1 ${categoryStyle(item.category)}`}>{item.category}</span>
      {item.publishedAt && (
        <time
          dateTime={item.publishedAt}
          className={`inline-flex items-center gap-1.5 ${inverted ? "text-white/75" : "text-zinc-500 dark:text-zinc-400"}`}
          title={exactDateFormatter.format(new Date(item.publishedAt))}
        >
          <Clock3 aria-hidden="true" className="h-3.5 w-3.5" />
          {relativeTime(item.publishedAt)}
        </time>
      )}
    </div>
  );
}

function LeadCard({ item }: { item: NewsItem }) {
  return (
    <article className="min-h-[32rem]">
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer external"
        className="group relative isolate block min-h-[32rem] overflow-hidden rounded-[1.75rem] bg-zinc-900 shadow-float outline-none ring-blue-500 transition hover:-translate-y-0.5 focus-visible:ring-4 motion-reduce:transform-none"
        aria-label={`${item.title} — loe ERR-is, avaneb uuel vahelehel`}
      >
        <div className="absolute inset-0">
          <ArticleImage item={item} eager />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/5" />
        <div className="relative flex min-h-[32rem] flex-col justify-end p-6 sm:p-8 lg:p-10">
          <ArticleMeta item={item} inverted />
          <h2 className="mt-5 max-w-3xl text-balance font-display text-3xl font-black leading-[1.04] tracking-[-0.035em] text-white sm:text-4xl lg:text-[2.75rem]">
            {item.title}
          </h2>
          {item.summary && (
            <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              {item.summary}
            </p>
          )}
          <span className="mt-6 inline-flex w-fit items-center gap-2 text-sm font-bold text-white">
            Loe ERR-is
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </a>
    </article>
  );
}

function CompactCard({ item }: { item: NewsItem }) {
  return (
    <article className="min-h-full">
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer external"
        className="group grid min-h-full grid-cols-[minmax(0,1.15fr)_minmax(8rem,.85fr)] overflow-hidden rounded-[1.5rem] border border-black/10 bg-white outline-none ring-blue-500 transition hover:-translate-y-0.5 hover:border-blue-400 focus-visible:ring-4 dark:border-white/10 dark:bg-[#14181d] dark:hover:border-blue-400 sm:grid-cols-[minmax(0,1.25fr)_minmax(10rem,.75fr)] lg:grid-cols-1 lg:grid-rows-[1fr_auto] motion-reduce:transform-none"
        aria-label={`${item.title} — loe ERR-is, avaneb uuel vahelehel`}
      >
        <div className="order-2 min-h-[12rem] lg:order-1 lg:min-h-0">
          <ArticleImage item={item} />
        </div>
        <div className="order-1 flex min-w-0 flex-col justify-between p-5 lg:order-2">
          <div>
            <ArticleMeta item={item} />
            <h2 className="mt-3 line-clamp-3 text-balance font-display text-xl font-extrabold leading-[1.15] tracking-[-0.025em] transition-colors group-hover:text-blue-700 dark:group-hover:text-blue-300">
              {item.title}
            </h2>
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
            Loe edasi <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
        </div>
      </a>
    </article>
  );
}

function StandardCard({ item }: { item: NewsItem }) {
  return (
    <article className="min-h-full">
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer external"
        className="group flex min-h-full flex-col overflow-hidden rounded-[1.5rem] border border-black/10 bg-white outline-none ring-blue-500 transition duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-float focus-visible:ring-4 dark:border-white/10 dark:bg-[#14181d] dark:hover:border-blue-400 motion-reduce:transform-none"
        aria-label={`${item.title} — loe ERR-is, avaneb uuel vahelehel`}
      >
        <div className="aspect-[16/10] w-full">
          <ArticleImage item={item} />
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <ArticleMeta item={item} />
          <h2 className="mt-4 text-balance font-display text-[1.35rem] font-extrabold leading-[1.15] tracking-[-0.025em] transition-colors group-hover:text-blue-700 dark:group-hover:text-blue-300">
            {item.title}
          </h2>
          {item.summary && (
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {item.summary}
            </p>
          )}
          <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-bold text-blue-700 dark:text-blue-300">
            Loe ERR-is
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </a>
    </article>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

function LoadingState() {
  return (
    <div role="status" aria-label="Uudiste laadimine" className="space-y-8">
      <span className="sr-only">Laadin värskeid uudiseid…</span>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.95fr)_minmax(20rem,1fr)]">
        <div className="skeleton min-h-[32rem] rounded-[1.75rem]" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          {[0, 1].map((item) => (
            <div key={item} className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-white dark:border-white/5 dark:bg-[#14181d]">
              <Skeleton className="h-28 rounded-none" />
              <div className="space-y-3 p-5">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="overflow-hidden rounded-[1.5rem] border border-black/5 bg-white dark:border-white/5 dark:bg-[#14181d]">
            <Skeleton className="aspect-[16/10] rounded-none" />
            <div className="space-y-3 p-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ hasQuery, onReset }: { hasQuery: boolean; onReset: () => void }) {
  return (
    <div className="grid min-h-[24rem] place-items-center rounded-[1.75rem] border border-dashed border-black/15 bg-white/45 px-6 text-center dark:border-white/15 dark:bg-white/[0.025]">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          <Search aria-hidden="true" className="h-5 w-5" />
        </span>
        <h2 className="mt-5 text-xl font-extrabold">Tulemusi ei leitud</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {hasQuery ? "Proovi teist märksõna või vaata kõiki teemasid." : "Selles kategoorias pole praegu uudiseid."}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-6 min-h-11 rounded-full bg-ink px-5 text-sm font-bold text-white outline-none ring-blue-500 hover:bg-blue-700 focus-visible:ring-4 dark:bg-white dark:text-ink dark:hover:bg-blue-200"
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
      return normalizeSearch(`${item.title} ${item.summary}`).includes(needle);
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
          <div className="flex min-h-[4.75rem] items-center justify-between gap-4 border-b border-black/10 py-3 dark:border-white/10">
            <a href="#" className="group flex items-center gap-3 rounded-lg outline-none ring-blue-500 focus-visible:ring-4" aria-label="117.ee avaleht">
              <span className="font-display text-[2rem] font-black leading-none tracking-[-0.06em]">
                <span className="text-blue-700 dark:text-blue-400">117</span>.ee
              </span>
              <span className="hidden border-l border-black/15 pl-3 text-[11px] font-semibold uppercase leading-4 tracking-[0.12em] text-zinc-500 dark:border-white/15 dark:text-zinc-400 sm:block">
                uudised<br />selges vaates
              </span>
            </a>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 md:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                ERR-i voog
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
            <nav aria-label="Uudiste kategooriad" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {CATEGORIES.map((item) => {
                const active = item === category;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    aria-pressed={active}
                    className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold outline-none ring-blue-500 transition focus-visible:ring-4 ${
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

            <label className="relative block w-full shrink-0 lg:w-[22rem]">
              <span className="sr-only">Otsi uudiseid</span>
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-[1.1rem] w-[1.1rem] -translate-y-1/2 text-zinc-500" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Otsi uudiseid…"
                className="h-11 w-full rounded-full border border-black/10 bg-white pl-11 pr-20 text-sm font-medium outline-none ring-blue-500 placeholder:text-zinc-400 hover:border-black/20 focus:border-blue-400 focus:ring-4 dark:border-white/10 dark:bg-white/[0.06] dark:placeholder:text-zinc-500 dark:hover:border-white/20"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-zinc-500 outline-none hover:bg-black/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/10 dark:hover:text-white"
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

      <main id="uudised" className="mx-auto max-w-[90rem] px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-10 lg:pb-24">
        <div className="mb-8 flex flex-col justify-between gap-6 border-b border-black/10 pb-7 dark:border-white/10 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-400">
              {dateFormatter.format(new Date())}
            </p>
            <h1 className="text-balance font-display text-[2.65rem] font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl">
              Uudised, selgelt.
            </h1>
          </div>
          <div aria-live="polite" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            {data && (
              <span className="font-semibold text-ink dark:text-white">
                {numberFormatter.format(filteredItems.length)} {filteredItems.length === 1 ? "lugu" : "lugu"}
              </span>
            )}
            <span>Uuendatud {updatedLabel}</span>
          </div>
        </div>

        {data && data.sources.failed.length > 0 && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Näitame {data.sources.loaded} allika värskeid uudiseid. Mõni voog ({data.sources.failed.join(", ")}) on ajutiselt kättesaamatu.
            </p>
          </div>
        )}

        {!data && !error && <LoadingState />}

        {error && (
          <div role="alert" className="grid min-h-[28rem] place-items-center rounded-[1.75rem] border border-red-300 bg-red-50/70 px-6 text-center dark:border-red-500/30 dark:bg-red-500/[0.08]">
            <div>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                <RefreshCw aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold">Uudised ei jõudnud kohale</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">{error}</p>
              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-bold text-white outline-none ring-blue-500 hover:bg-blue-700 focus-visible:ring-4 dark:bg-white dark:text-ink dark:hover:bg-blue-200"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" /> Proovi uuesti
              </button>
            </div>
          </div>
        )}

        {data && filteredItems.length === 0 && (
          <EmptyState hasQuery={Boolean(query)} onReset={resetFilters} />
        )}

        {data && filteredItems.length > 0 && (
          <div className="space-y-10">
            <section aria-label="Esiletõstetud uudised" className="grid gap-5 lg:grid-cols-[minmax(0,1.95fr)_minmax(20rem,1fr)]">
              <LeadCard item={filteredItems[0]} />
              {filteredItems.length > 1 && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                  {filteredItems.slice(1, 3).map((item) => (
                    <CompactCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </section>

            {filteredItems.length > 3 && (
              <section aria-labelledby="rohkem-uudiseid">
                <div className="mb-5 flex items-center justify-between">
                  <h2 id="rohkem-uudiseid" className="text-sm font-black uppercase tracking-[0.16em]">
                    Rohkem uudiseid
                  </h2>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Allikas: ERR</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredItems.slice(3).map((item) => (
                    <StandardCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-4 px-4 py-8 text-xs leading-5 text-zinc-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-black tracking-[-0.04em] text-ink dark:text-white">
              <span className="text-blue-700 dark:text-blue-400">117</span>.ee
            </span>
            <span>Selgem tee oluliste uudisteni.</span>
          </div>
          <p>Uudiste sisu ja fotod kuuluvad ERR-ile. Lingid avanevad ERR-i veebis.</p>
        </div>
      </footer>
    </div>
  );
}
