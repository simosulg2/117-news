"use client";

import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";

import { CATEGORIES, type Category, type NewsArticle, type NewsItem, type NewsResponse } from "@/lib/types";

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
const READ_STORAGE_KEY = "117-read-articles";
const READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

type ReadTimestamps = Record<string, number>;

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

function relatedItems(item: NewsItem): NewsArticle[] {
  return item.related ?? [];
}

function readKeyForItem(item: NewsArticle): string {
  const link = item.link.trim();
  if (!link) return `id:${item.id}`;

  try {
    const url = new URL(link);
    url.hash = "";
    return `url:${url.toString()}`;
  } catch {
    return `url:${link}`;
  }
}

function pruneReadTimestamps(value: unknown, nowMs = Date.now()): ReadTimestamps {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const cutoff = nowMs - READ_RETENTION_MS;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        Boolean(entry[0]) && typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= cutoff,
    ),
  );
}

function parseReadTimestamps(value: string | null): ReadTimestamps {
  if (!value) return {};
  try {
    return pruneReadTimestamps(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
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

type ArticleRowProps = {
  item: NewsItem;
  nowMs: number;
  isRead: (item: NewsArticle) => boolean;
  onOpen: (item: NewsArticle) => void;
  registerHeadline: (id: string, node: HTMLAnchorElement | null) => void;
};

function ArticleRow({ item, nowMs, isRead, onOpen, registerHeadline }: ArticleRowProps) {
  const [relatedOpen, setRelatedOpen] = useState(false);
  const relatedPanelId = useId();
  const related = relatedItems(item);
  const itemIsRead = isRead(item);
  const relatedButtonText = `+${related.length} seotud ${related.length === 1 ? "allikas" : "allikat"}`;

  return (
    <li>
      <article
        data-news-row-id={item.id}
        className={`terminal-row group relative grid min-h-[5.25rem] grid-cols-1 gap-1.5 border-b border-[#bccbd6] px-2 py-3 transition-colors before:transition-opacity hover:bg-[#4f8cff]/[0.07] focus-within:bg-[#4f8cff]/[0.1] focus-within:before:opacity-100 dark:border-[#24394a] md:grid-cols-[9rem_8rem_minmax(0,1fr)_11rem] md:gap-x-5 md:py-3 ${
          itemIsRead ? "bg-[#edf1f3]/60 dark:bg-[#0a1823]/60" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden">
          <CategoryLabel category={item.category} />
          <span
            className={`text-[11px] font-semibold ${
              itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"
            }`}
          >
            {item.source}
          </span>
          {item.publishedAt && (
            <time
              dateTime={item.publishedAt}
              title={exactDateFormatter.format(new Date(item.publishedAt))}
              className={`text-xs tabular-nums ${
                itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"
              }`}
            >
              {formatItemTime(item.publishedAt)} / {relativeTime(item.publishedAt, nowMs)}
            </time>
          )}
          {related.length > 0 && (
            <button
              type="button"
              onClick={() => setRelatedOpen((current) => !current)}
              aria-expanded={relatedOpen}
              aria-controls={relatedPanelId}
              className="min-h-7 border border-[#90a4b2] px-2 text-[11px] font-bold text-[#245fae] outline-none hover:border-[#4f8cff] hover:bg-[#4f8cff]/10 focus-visible:ring-1 focus-visible:ring-signal dark:border-[#3b5870] dark:text-[#7db0ff]"
            >
              {relatedButtonText}
            </button>
          )}
        </div>

        {item.publishedAt ? (
          <time
            dateTime={item.publishedAt}
            title={exactDateFormatter.format(new Date(item.publishedAt))}
            className={`hidden whitespace-nowrap text-xs font-medium tabular-nums md:block ${
              itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#495e6d] dark:text-[#a9b7c2]"
            }`}
          >
            {formatItemTime(item.publishedAt)}{" "}
            <span className="mx-1 text-[#738795] dark:text-[#7890a2]">/</span>
            <span className={itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"}>
              {relativeTime(item.publishedAt, nowMs)}
            </span>
          </time>
        ) : (
          <span className="hidden text-xs text-[#526878] dark:text-[#8da1b0] md:block">—</span>
        )}

        <div className="hidden md:block">
          <CategoryLabel category={item.category} />
        </div>

        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 text-base font-bold leading-[1.35] md:text-[17px]">
              <a
                ref={(node) => registerHeadline(item.id, node)}
                data-news-primary-id={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer external"
                onClick={() => onOpen(item)}
                onAuxClick={(event) => {
                  if (event.button === 1) onOpen(item);
                }}
                className={`outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f8f9] dark:focus-visible:ring-offset-[#07131f] ${
                  itemIsRead
                    ? "text-[#526878] hover:text-[#3f668d] dark:text-[#778b98] dark:hover:text-[#9ab6c9]"
                    : "text-[#101a24] group-hover:text-[#245fae] dark:text-[#edf4f8] dark:group-hover:text-[#7db0ff]"
                }`}
                aria-label={`${item.title} — ${item.source}, avaneb uuel vahelehel`}
              >
                {item.title}
              </a>
            </h2>
          </div>
          {item.summary && (
            <p
              className={`mt-1 line-clamp-2 max-w-5xl text-xs leading-[1.5] md:line-clamp-1 md:text-[13px] md:leading-[1.55] ${
                itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"
              }`}
            >
              {item.summary}
            </p>
          )}
        </div>

        <div className="hidden min-w-0 flex-col items-start gap-1.5 md:flex">
          <span
            className={`max-w-full truncate text-xs font-semibold ${
              itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#495e6d] dark:text-[#a9b7c2]"
            }`}
            title={item.source}
          >
            {item.source}
          </span>
          {related.length > 0 && (
            <button
              type="button"
              onClick={() => setRelatedOpen((current) => !current)}
              aria-expanded={relatedOpen}
              aria-controls={relatedPanelId}
              className="min-h-7 max-w-full border border-[#90a4b2] px-2 text-left text-[11px] font-bold leading-4 text-[#245fae] outline-none hover:border-[#4f8cff] hover:bg-[#4f8cff]/10 focus-visible:ring-1 focus-visible:ring-signal dark:border-[#3b5870] dark:text-[#7db0ff]"
            >
              {relatedButtonText}
            </button>
          )}
        </div>

        {related.length > 0 && relatedOpen && (
          <div
            id={relatedPanelId}
            className="col-span-full mt-1 border-y border-[#aebfca] bg-[#e8eef2]/75 dark:border-[#2d4659] dark:bg-[#0d2030]/80"
          >
            <h3 className="sr-only">Seotud allikad uudisele „{item.title}“</h3>
            <ul className="divide-y divide-[#bdcad3] dark:divide-[#294154]">
              {related.map((relatedItem) => {
                const relatedIsRead = isRead(relatedItem);

                return (
                  <li
                    key={`${relatedItem.id}-${relatedItem.link}`}
                    className="grid gap-x-4 gap-y-1 px-2 py-2 sm:grid-cols-[8.5rem_9.5rem_minmax(0,1fr)] sm:items-start"
                  >
                    <span className="text-[11px] font-semibold text-[#526878] dark:text-[#8da1b0]">
                      {relatedItem.source}
                    </span>
                    {relatedItem.publishedAt ? (
                      <time
                        dateTime={relatedItem.publishedAt}
                        title={exactDateFormatter.format(new Date(relatedItem.publishedAt))}
                        className="text-[11px] tabular-nums text-[#526878] dark:text-[#8da1b0]"
                      >
                        {formatItemTime(relatedItem.publishedAt)} / {relativeTime(relatedItem.publishedAt, nowMs)}
                      </time>
                    ) : (
                      <span className="text-[11px] text-[#5a6d79] dark:text-[#708390]">—</span>
                    )}
                    <div className="flex min-w-0 items-start gap-2">
                      <a
                        href={relatedItem.link}
                        target="_blank"
                        rel="noopener noreferrer external"
                        onClick={() => onOpen(relatedItem)}
                        onAuxClick={(event) => {
                          if (event.button === 1) onOpen(relatedItem);
                        }}
                        className={`min-w-0 text-xs font-semibold leading-5 underline decoration-transparent underline-offset-2 outline-none hover:decoration-current focus-visible:ring-2 focus-visible:ring-signal ${
                          relatedIsRead
                            ? "text-[#5a6d79] dark:text-[#708390]"
                            : "text-[#263d50] dark:text-[#dce7ee]"
                        }`}
                        aria-label={`${relatedItem.title} — ${relatedItem.source}, avaneb uuel vahelehel`}
                      >
                        {relatedItem.title}
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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
          className="grid min-h-[5.25rem] grid-cols-1 gap-2 border-b border-[#bccbd6] px-2 py-3 dark:border-[#24394a] md:grid-cols-[9rem_8rem_minmax(0,1fr)_11rem] md:gap-x-5"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="hidden h-3 w-16 md:block" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full max-w-3xl" />
            <Skeleton className="h-3 w-3/4 max-w-2xl" />
          </div>
          <Skeleton className="hidden h-3 w-24 md:block" />
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
  const [readTimestamps, setReadTimestamps] = useState<ReadTimestamps>({});
  const [readStateLoaded, setReadStateLoaded] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const headlineRefs = useRef(new Map<string, HTMLAnchorElement>());

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      setReadTimestamps(parseReadTimestamps(localStorage.getItem(READ_STORAGE_KEY)));
    } catch {
      setReadTimestamps({});
    }
    setReadStateLoaded(true);

    function handleStorage(event: StorageEvent) {
      if (event.key !== READ_STORAGE_KEY) return;
      setReadTimestamps(parseReadTimestamps(event.newValue));
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!readStateLoaded) return;

    try {
      if (Object.keys(readTimestamps).length === 0) {
        localStorage.removeItem(READ_STORAGE_KEY);
      } else {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readTimestamps));
      }
    } catch {
      // The feed stays usable when browser storage is unavailable.
    }
  }, [readStateLoaded, readTimestamps]);

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

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("117-theme", next);
      } catch {
        // Theme switching still works for this page when storage is unavailable.
      }
      return next;
    });
  }, []);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const needle = normalizeSearch(deferredQuery.trim());
    const availableItems = category === "Kõik"
      ? data.items
      : data.itemsByCategory?.[category] ?? data.items;

    return availableItems.filter((item) => {
      if (category !== "Kõik" && item.category !== category) return false;
      if (!needle) return true;
      const relatedSearchText = relatedItems(item)
        .map((relatedItem) => `${relatedItem.title} ${relatedItem.summary} ${relatedItem.category} ${relatedItem.source}`)
        .join(" ");
      return normalizeSearch(`${item.title} ${item.summary} ${item.category} ${item.source} ${relatedSearchText}`).includes(
        needle,
      );
    });
  }, [category, data, deferredQuery]);

  const visibleItemIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false'])")) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.shiftKey || (event.key !== "j" && event.key !== "k") || visibleItemIds.length === 0) return;

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeId =
        activeElement?.dataset.newsPrimaryId ??
        activeElement?.closest<HTMLElement>("[data-news-row-id]")?.dataset.newsRowId;
      const currentIndex = activeId ? visibleItemIds.indexOf(activeId) : -1;
      const nextIndex =
        event.key === "j"
          ? currentIndex < 0
            ? 0
            : Math.min(currentIndex + 1, visibleItemIds.length - 1)
          : currentIndex < 0
            ? visibleItemIds.length - 1
            : Math.max(currentIndex - 1, 0);
      const nextHeadline = headlineRefs.current.get(visibleItemIds[nextIndex]);
      if (!nextHeadline) return;

      event.preventDefault();
      nextHeadline.focus({ preventScroll: true });
      nextHeadline.scrollIntoView({ block: "nearest" });
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [visibleItemIds]);

  const registerHeadline = useCallback((id: string, node: HTMLAnchorElement | null) => {
    if (node) {
      headlineRefs.current.set(id, node);
    } else {
      headlineRefs.current.delete(id);
    }
  }, []);

  const isItemRead = useCallback(
    (item: NewsArticle) => Object.prototype.hasOwnProperty.call(readTimestamps, readKeyForItem(item)),
    [readTimestamps],
  );

  const markItemRead = useCallback((item: NewsArticle) => {
    const key = readKeyForItem(item);
    const timestamp = Date.now();
    setReadTimestamps((current) => pruneReadTimestamps({ ...current, [key]: timestamp }, timestamp));
  }, []);

  const resetReadHistory = useCallback(() => {
    setReadTimestamps({});
  }, []);

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

  const readCount = Object.keys(readTimestamps).length;

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
          <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[#263d50] sm:gap-4">
            <div className="flex min-w-0 self-stretch">
              <a href="/" className="flex items-center gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-signal" aria-label="117.ee avaleht">
                <span className="block size-10 shrink-0" aria-hidden="true">
                  <img src="/117.png" alt="" className="size-full object-contain" />
                </span>
                <span className="hidden text-[13px] font-medium text-[#8da1b0] lg:inline">Eesti uudisvoog</span>
              </a>

              <nav aria-label="Põhinavigatsioon" className="ml-2 flex border-l border-[#263d50] sm:ml-4">
                <a
                  href="/"
                  aria-current="page"
                  className="flex min-h-12 items-center border-r border-[#263d50] bg-[#102538] px-3 text-xs font-bold text-signal outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:px-4"
                >
                  Uudised
                </a>
                <a
                  href="/ilm"
                  className="flex min-h-12 items-center border-r border-[#263d50] px-3 text-xs font-semibold text-[#a9b7c2] outline-none hover:bg-[#102538] hover:text-white focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:px-4"
                >
                  Ilm
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="hidden text-[#8da1b0] sm:inline">
                <b aria-live="polite" className={data && data.sources.loaded === data.sources.total ? "text-[#55d6b2]" : "text-[#b6a3ff]"}>{data ? `${data.sources.loaded}/${data.sources.total} voogu` : "—/5 voogu"}</b>
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pealkiri, allikas või märksõna"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-[#8da1b0] focus:bg-[#06101a]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={clearSearch}
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

      <main
        id="newswire"
        tabIndex={-1}
        className="mx-auto max-w-[96rem] px-3 pb-10 pt-4 outline-none sm:px-5 lg:px-7"
      >
        <div className="mb-3 grid gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 text-xs font-semibold text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2] sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="font-bold text-[#245fae] dark:text-signal">117 uudislaud</h1>
            <span>{now ? deskDateFormatter.format(now) : "--.--.----"}</span>
            <span>Eesti uudised</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums">
            <span aria-live="polite">
              {data
                ? data.sources.failed.length === 0 && category === "Kõik" && !deferredQuery.trim() && filteredItems.length === 117
                  ? "117 värskeimat uudist"
                  : `${numberFormatter.format(filteredItems.length)} uudist`
                : "— uudist"}
            </span>
            <span>Teema: {category}</span>
            <span>Uuendatud: {data ? relativeTime(data.updatedAt, now?.getTime()) : "—"}</span>
            {readStateLoaded && readCount > 0 && (
              <button
                type="button"
                onClick={resetReadHistory}
                className="font-semibold text-[#4b6170] underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#8da1b0] dark:hover:text-[#7db0ff]"
                title={`${numberFormatter.format(readCount)} loetud artiklit selles brauseris`}
              >
                Taasta kõik lugemata
              </button>
            )}
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
          <section aria-label="Uudiste nimekiri" aria-keyshortcuts="j k">
            <div className="hidden grid-cols-[9rem_8rem_minmax(0,1fr)_11rem] gap-x-5 border-y border-[#9fb2c0] bg-[#d5e0e7] px-2 py-1.5 text-[11px] font-semibold text-[#4b6170] dark:border-[#35536a] dark:bg-[#102538] dark:text-[#7890a2] md:grid">
              <span>Avaldatud / möödas</span>
              <span>Teema</span>
              <span>Uudis</span>
              <span>Allikas</span>
            </div>
            <ul>
              {filteredItems.map((item) => (
                <ArticleRow
                  key={item.id}
                  item={item}
                  nowMs={now?.getTime() ?? Date.now()}
                  isRead={isItemRead}
                  onOpen={markItemRead}
                  registerHeadline={registerHeadline}
                />
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="border-t border-[#9fb2c0] bg-[#dfe8ee] dark:border-[#35536a] dark:bg-[#0b1b29]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-2 px-3 py-3 text-[11px] text-[#526878] dark:text-[#7890a2] sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-7">
          <span><b className="text-[#245fae] dark:text-signal">117.ee</b> · Eesti uudisvoog</span>
          <span>Allikad: ERR ja Postimees · Lingid avanevad algallikas</span>
        </div>
      </footer>
    </div>
  );
}
