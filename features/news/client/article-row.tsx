"use client";

import { useEffect, useId, useState } from "react";

import { exactDateFormatter, formatNewsItemTime } from "@/features/news/client/news-formatters";
import { RelatedCoveragePanel, StoryTimeline } from "@/features/news/client/story-timeline";
import { useNewsStoryDetail } from "@/features/news/client/use-news-story-detail";
import { newsRowId, relatedNewsItems, relativeNewsTime } from "@/features/news/model/news-items";
import type { NewsArticle, NewsItem, NewsStoryPreview } from "@/lib/types";

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

type TimelineToggleProps = {
  controls: string;
  label: string;
  open: boolean;
  onToggle: () => void;
};

function TimelineToggle({ controls, label, open, onToggle }: TimelineToggleProps) {
  const action = open ? "Sulge" : "Ava";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${action} ${label}`}
      className="min-h-7 max-w-full border border-[#90a4b2] px-2 text-left text-[11px] font-bold leading-4 text-[#245fae] outline-none hover:border-[#4f8cff] hover:bg-[#4f8cff]/10 focus-visible:ring-1 focus-visible:ring-signal dark:border-[#3b5870] dark:text-[#7db0ff]"
    >
      {label}
    </button>
  );
}

export type ArticleRowProps = {
  item: NewsItem;
  nowMs: number;
  isRead: (item: NewsArticle) => boolean;
  isStoryArticleNew: (storyId: string, addedVersion: number) => boolean;
  isStoryNew: (story: NewsStoryPreview) => boolean;
  onOpen: (item: NewsArticle) => void;
  onStorySeen: (story: NewsStoryPreview) => void;
  registerHeadline: (id: string, node: HTMLAnchorElement | null) => void;
};

export function ArticleRow({
  item,
  nowMs,
  isRead,
  isStoryArticleNew,
  isStoryNew,
  onOpen,
  onStorySeen,
  registerHeadline,
}: ArticleRowProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const related = relatedNewsItems(item);
  const rowId = newsRowId(item);
  const itemIsRead = isRead(item);
  const persistentStory = item.story && item.story.articleCount > 1 ? item.story : null;
  const hasExpandableCoverage = Boolean(persistentStory || related.length > 0);
  const toggleLabel = persistentStory
    ? `${persistentStory.articleCount} kajastust · ajajoon`
    : `+${related.length} seotud ${related.length === 1 ? "allikas" : "allikat"}`;
  const detail = useNewsStoryDetail(persistentStory, panelOpen);
  const storyIsNew = Boolean(item.story && isStoryNew(item.story));

  useEffect(() => {
    if (panelOpen && detail.data) onStorySeen(detail.data.story);
  }, [detail.data, onStorySeen, panelOpen]);

  function handleArticleOpen(article: NewsArticle) {
    onOpen(article);
    if (item.story) {
      const detailStory = detail.data?.story;
      onStorySeen(detailStory && detailStory.version > item.story.version ? detailStory : item.story);
    }
  }

  const toggle = hasExpandableCoverage ? (
    <TimelineToggle
      controls={panelId}
      label={toggleLabel}
      open={panelOpen}
      onToggle={() => setPanelOpen((current) => !current)}
    />
  ) : null;

  return (
    <li>
      <article
        data-news-row-id={rowId}
        className={`terminal-row group relative grid min-h-[5.25rem] grid-cols-1 gap-1.5 border-b border-[#bccbd6] px-2 py-3 transition-colors before:transition-opacity hover:bg-[#4f8cff]/[0.07] focus-within:bg-[#4f8cff]/[0.1] focus-within:before:opacity-100 dark:border-[#24394a] md:grid-cols-[9rem_8rem_minmax(0,1fr)_11rem] md:gap-x-5 md:py-3 ${
          itemIsRead ? "bg-[#edf1f3]/60 dark:bg-[#0a1823]/60" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden">
          <CategoryLabel category={item.category} />
          <span className={`text-[11px] font-semibold ${itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"}`}>
            {item.source}
          </span>
          {item.publishedAt && (
            <time dateTime={item.publishedAt} title={exactDateFormatter.format(new Date(item.publishedAt))} className={`text-xs tabular-nums ${itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"}`}>
              {formatNewsItemTime(item.publishedAt)} / {relativeNewsTime(item.publishedAt, nowMs)}
            </time>
          )}
          {toggle}
        </div>

        {item.publishedAt ? (
          <time dateTime={item.publishedAt} title={exactDateFormatter.format(new Date(item.publishedAt))} className={`hidden whitespace-nowrap text-xs font-medium tabular-nums md:block ${itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#495e6d] dark:text-[#a9b7c2]"}`}>
            {formatNewsItemTime(item.publishedAt)} <span className="mx-1 text-[#738795] dark:text-[#7890a2]">/</span>
            <span className={itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"}>{relativeNewsTime(item.publishedAt, nowMs)}</span>
          </time>
        ) : <span className="hidden text-xs text-[#526878] dark:text-[#8da1b0] md:block">—</span>}

        <div className="hidden md:block"><CategoryLabel category={item.category} /></div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-start gap-2">
            <h2 className="min-w-0 text-base font-bold leading-[1.35] md:text-[17px]">
              <a
                ref={(node) => registerHeadline(rowId, node)}
                data-news-primary-id={rowId}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer external"
                onClick={() => handleArticleOpen(item)}
                onAuxClick={(event) => {
                  if (event.button === 1) handleArticleOpen(item);
                }}
                className={`outline-none transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f8f9] dark:focus-visible:ring-offset-[#07131f] ${itemIsRead ? "text-[#526878] hover:text-[#3f668d] dark:text-[#778b98] dark:hover:text-[#9ab6c9]" : "text-[#101a24] group-hover:text-[#245fae] dark:text-[#edf4f8] dark:group-hover:text-[#7db0ff]"}`}
                aria-label={`${item.title} — ${item.source}, avaneb uuel vahelehel`}
              >
                {item.title}
              </a>
            </h2>
            {storyIsNew && <span className="mt-0.5 border border-[#245fae] px-1 text-[9px] font-bold leading-4 text-[#245fae] dark:border-signal dark:text-signal"><span aria-hidden="true">UUS</span><span className="sr-only">Uus kajastus pärast eelmist külastust</span></span>}
          </div>
          {item.summary && <p className={`mt-1 line-clamp-2 max-w-5xl text-xs leading-[1.5] md:line-clamp-1 md:text-[13px] md:leading-[1.55] ${itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#526878] dark:text-[#8da1b0]"}`}>{item.summary}</p>}
        </div>

        <div className="hidden min-w-0 flex-col items-start gap-1.5 md:flex">
          <span className={`max-w-full truncate text-xs font-semibold ${itemIsRead ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#495e6d] dark:text-[#a9b7c2]"}`} title={item.source}>{item.source}</span>
          {toggle}
        </div>

        {panelOpen && persistentStory && (
          <StoryTimeline
            id={panelId}
            title={item.title}
            data={detail.data}
            error={detail.error}
            fallback={related}
            loading={detail.loading}
            nowMs={nowMs}
            isRead={isRead}
            isArticleNew={(article) => isStoryArticleNew(persistentStory.id, article.addedVersion)}
            onOpen={handleArticleOpen}
            onRetry={detail.retry}
          />
        )}
        {panelOpen && !persistentStory && related.length > 0 && (
          <RelatedCoveragePanel id={panelId} title={item.title} related={related} nowMs={nowMs} isRead={isRead} onOpen={handleArticleOpen} />
        )}
      </article>
    </li>
  );
}
