"use client";

import { Search, X, Radio, RotateCcw } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { FeedCategory, NewsItem } from "@/lib/news";
import ThemeToggle from "./theme-toggle";
import NewsCard from "./news-card";

const filters: Array<"Kõik" | FeedCategory> = ["Kõik", "Viimased", "Eesti", "Majandus", "Kultuur", "Sport", "English"];

type Props = {
  initialItems: NewsItem[];
  failedFeeds: FeedCategory[];
};

export default function NewsPortal({ initialItems, failedFeeds }: Props) {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]>("Kõik");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const visibleItems = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("et");
    return initialItems.filter((item) => {
      const inCategory = activeFilter === "Kõik" || item.categories.includes(activeFilter);
      const matchesSearch = !needle || `${item.title} ${item.summary}`.toLocaleLowerCase("et").includes(needle);
      return inCategory && matchesSearch;
    });
  }, [activeFilter, deferredQuery, initialItems]);

  const date = new Intl.DateTimeFormat("et-EE", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const hasPartialFailure = failedFeeds.length > 0 && initialItems.length > 0;

  function resetFilters() {
    setActiveFilter("Kõik");
    setQuery("");
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <div className="header-main container">
          <a href="#top" className="brand" aria-label="117.ee avaleht">
            <span>117</span><span className="brand-dot">.</span><span className="brand-ee">ee</span>
          </a>

          <label className="search-box">
            <Search size={19} strokeWidth={1.8} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Otsi uudistest…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Otsi uudistest"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Tühjenda otsing" type="button">
                <X size={17} />
              </button>
            )}
            <kbd>⌘ K</kbd>
          </label>

          <ThemeToggle />
        </div>

        <div className="category-row container" role="navigation" aria-label="Uudiste kategooriad">
          {filters.map((filter) => (
            <button
              key={filter}
              className={activeFilter === filter ? "category-button active" : "category-button"}
              onClick={() => setActiveFilter(filter)}
              aria-pressed={activeFilter === filter}
            >
              {filter}
            </button>
          ))}
          <span className="live-label"><span /> ERR RSS</span>
        </div>
      </header>

      <section className="container page-content" id="top">
        <div className="intro-row">
          <div>
            <p className="eyebrow"><Radio size={14} /> Uudispilt praegu</p>
            <h1>{activeFilter === "Kõik" ? "Oluline ühes vaates" : activeFilter}</h1>
          </div>
          <div className="date-block">
            <span>{date}</span>
            <small>{visibleItems.length} uudist</small>
          </div>
        </div>

        {hasPartialFailure && (
          <div className="feed-notice" role="status">
            Mõni kanal ei vastanud ({failedFeeds.join(", ")}). Näitame ülejäänud värskeid uudiseid.
          </div>
        )}

        {visibleItems.length > 0 ? (
          <>
            <section className="lead-grid" aria-label="Peamised uudised">
              <NewsCard item={visibleItems[0]} featured />
              <div className="lead-side">
                {visibleItems.slice(1, 5).map((item) => <NewsCard item={item} key={item.id} />)}
              </div>
            </section>

            {visibleItems.length > 5 && (
              <section className="latest-section" aria-labelledby="latest-heading">
                <div className="section-heading">
                  <h2 id="latest-heading">Veel värskeid</h2>
                  <span>{visibleItems.length - 5} artiklit</span>
                </div>
                <div className="news-grid">
                  {visibleItems.slice(5).map((item) => <NewsCard item={item} key={item.id} />)}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><Search size={28} strokeWidth={1.6} /></div>
            <h2>{initialItems.length === 0 ? "Uudistevoog ei ole hetkel saadaval" : "Sellist uudist ei leidnud"}</h2>
            <p>{initialItems.length === 0 ? "ERR-i kanalid ei vastanud. Proovi mõne hetke pärast uuesti." : "Muuda otsingusõna või vaata kõiki kategooriaid."}</p>
            <button onClick={initialItems.length === 0 ? () => window.location.reload() : resetFilters}>
              <RotateCcw size={16} /> {initialItems.length === 0 ? "Proovi uuesti" : "Lähtesta filtrid"}
            </button>
          </div>
        )}
      </section>

      <footer className="site-footer container">
        <p><strong>117.ee</strong> koondab avalikud ERR-i RSS-kanalid mugavaks uudisvaateks.</p>
        <p>Artiklid ja fotod kuuluvad nende algallikale. Kõik lingid avanevad ERR-is.</p>
      </footer>
    </main>
  );
}
