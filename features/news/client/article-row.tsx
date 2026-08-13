"use client";

import { useId, useState } from "react";

import { exactDateFormatter, formatNewsItemTime } from "@/features/news/client/news-formatters";
import { relatedNewsItems, relativeNewsTime } from "@/features/news/model/news-items";
import type { NewsArticle, NewsItem } from "@/lib/types";

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

export type ArticleRowProps = {
  item: NewsItem;
  nowMs: number;
  isRead: (item: NewsArticle) => boolean;
  onOpen: (item: NewsArticle) => void;
  registerHeadline: (id: string, node: HTMLAnchorElement | null) => void;
};

export function ArticleRow({ item, nowMs, isRead, onOpen, registerHeadline }: ArticleRowProps) {
  const [relatedOpen, setRelatedOpen] = useState(false);
  const relatedPanelId = useId();
  const related = relatedNewsItems(item);
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
              {formatNewsItemTime(item.publishedAt)} / {relativeNewsTime(item.publishedAt, nowMs)}
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
            {formatNewsItemTime(item.publishedAt)}{" "}
            <span className="mx-1 text-[#738795] dark:text-[#7890a2]">/</span>
            <span className={itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"}>
              {relativeNewsTime(item.publishedAt, nowMs)}
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
                        {formatNewsItemTime(relatedItem.publishedAt)} / {relativeNewsTime(relatedItem.publishedAt, nowMs)}
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
