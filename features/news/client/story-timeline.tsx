import { exactDateFormatter, formatNewsItemTime } from "@/features/news/client/news-formatters";
import {
  orderedNewsStoryArticles,
  orderedNewsStoryEvents,
  relativeNewsTime,
} from "@/features/news/model/news-items";
import type {
  NewsArticle,
  NewsStoryDetailResponse,
} from "@/lib/types";

type ArticleActions = {
  isRead: (article: NewsArticle) => boolean;
  onOpen: (article: NewsArticle) => void;
};

type RelatedCoveragePanelProps = ArticleActions & {
  id: string;
  nowMs: number;
  related: readonly NewsArticle[];
  title: string;
};

function ArticleTime({ article, nowMs }: { article: NewsArticle; nowMs: number }) {
  if (!article.publishedAt) {
    return <span className="text-[11px] text-[#5a6d79] dark:text-[#708390]">—</span>;
  }
  const timestamp = Date.parse(article.publishedAt);
  if (!Number.isFinite(timestamp)) {
    return <span className="text-[11px] text-[#5a6d79] dark:text-[#708390]">—</span>;
  }
  return (
    <time
      dateTime={article.publishedAt}
      title={exactDateFormatter.format(new Date(timestamp))}
      className="text-[11px] tabular-nums text-[#526878] dark:text-[#8da1b0]"
    >
      {formatNewsItemTime(article.publishedAt)} / {relativeNewsTime(article.publishedAt, nowMs)}
    </time>
  );
}

function CoverageLink({ article, isRead, onOpen }: ArticleActions & { article: NewsArticle }) {
  const read = isRead(article);
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer external"
      onClick={() => onOpen(article)}
      onAuxClick={(event) => {
        if (event.button === 1) onOpen(article);
      }}
      className={`min-w-0 text-xs font-semibold leading-5 underline decoration-transparent underline-offset-2 outline-none hover:decoration-current focus-visible:ring-2 focus-visible:ring-signal ${
        read ? "text-[#5a6d79] dark:text-[#708390]" : "text-[#263d50] dark:text-[#dce7ee]"
      }`}
      aria-label={`${article.title} — ${article.source}, avaneb uuel vahelehel`}
    >
      {article.title}
    </a>
  );
}

export function RelatedCoveragePanel({
  id,
  isRead,
  nowMs,
  onOpen,
  related,
  title,
}: RelatedCoveragePanelProps) {
  return (
    <div id={id} className="col-span-full mt-1 border-y border-[#aebfca] bg-[#e8eef2]/75 dark:border-[#2d4659] dark:bg-[#0d2030]/80">
      <h3 className="sr-only">Seotud allikad uudisele „{title}“</h3>
      <ul className="divide-y divide-[#bdcad3] dark:divide-[#294154]">
        {related.map((article) => (
          <li key={`${article.id}-${article.link}`} className="grid gap-x-4 gap-y-1 px-2 py-2 sm:grid-cols-[8.5rem_9.5rem_minmax(0,1fr)] sm:items-start">
            <span className="text-[11px] font-semibold text-[#526878] dark:text-[#8da1b0]">{article.source}</span>
            <ArticleTime article={article} nowMs={nowMs} />
            <CoverageLink article={article} isRead={isRead} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </div>
  );
}

type StoryTimelineProps = ArticleActions & {
  data: NewsStoryDetailResponse | null;
  error: string | null;
  fallback: readonly NewsArticle[];
  id: string;
  loading: boolean;
  nowMs: number;
  onRetry: () => void;
  title: string;
};

function eventLabel(index: number, count: number): string {
  if (count <= 1) return "Kajastus";
  if (index === 0) return "Esimene kajastus";
  if (index === count - 1) return "Viimane kajastus";
  return `Kajastus ${index + 1}`;
}

export function StoryTimeline({
  data,
  error,
  fallback,
  id,
  isRead,
  loading,
  nowMs,
  onOpen,
  onRetry,
  title,
}: StoryTimelineProps) {
  const events = orderedNewsStoryEvents(data?.events ?? []);
  const headingId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      aria-busy={loading}
      className="col-span-full mt-1 border-y border-[#8da2b0] bg-[#e8eef2]/75 dark:border-[#35536a] dark:bg-[#0d2030]/80"
    >
      <header className="border-b border-[#bdcad3] px-3 py-2 dark:border-[#294154]">
        <h3 id={headingId} className="text-xs font-bold text-[#193b56] dark:text-[#dce7ee]">Kajastuse ajajoon</h3>
        <p className="mt-1 text-[11px] leading-4 text-[#526878] dark:text-[#8da1b0]">
          Seosed on loodud automaatselt RSS-pealkirjade ja -kirjelduste põhjal.
        </p>
      </header>

      {error && (
        <div role="alert" className="m-3 flex flex-wrap items-center justify-between gap-2 border border-[#9d762f] px-3 py-2 text-xs text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
          <span>{error}</span>
          <button type="button" onClick={onRetry} className="min-h-8 border border-current px-3 font-bold outline-none focus-visible:ring-2 focus-visible:ring-signal">
            Proovi uuesti
          </button>
        </div>
      )}

      {loading && !data && (
        <div role="status" className="space-y-2 px-3 py-4">
          <span className="sr-only">Laadin kajastuse ajajoont…</span>
          <div className="skeleton h-3 w-36" />
          <div className="skeleton h-4 w-full max-w-3xl" />
          <div className="skeleton h-4 w-4/5 max-w-2xl" />
        </div>
      )}

      {data && events.length === 0 && (
        <p className="px-3 py-4 text-xs text-[#526878] dark:text-[#8da1b0]">Selle loo varasemaid kajastusi ei leitud.</p>
      )}

      {data && events.length > 0 && (
        <ol className="divide-y divide-[#bdcad3] dark:divide-[#294154]">
          {events.map((event, eventIndex) => (
            <li key={event.id} className="grid gap-2 px-3 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#526878] dark:text-[#8da1b0]">
                <span>{eventLabel(eventIndex, events.length)}</span>
                <span className="mt-1 block normal-case tracking-normal">{event.articles.length} {event.articles.length === 1 ? "allikas" : "allikat"}</span>
              </div>
              <ul className="space-y-2">
                {orderedNewsStoryArticles(event.articles).map((article) => (
                  <li key={article.id} className="grid gap-x-3 gap-y-1 sm:grid-cols-[7rem_9.5rem_minmax(0,1fr)] sm:items-start">
                    <span className="text-[11px] font-semibold text-[#526878] dark:text-[#8da1b0]">{article.source}</span>
                    <ArticleTime article={article} nowMs={nowMs} />
                    <div className="min-w-0">
                      <div className="min-w-0">
                        <CoverageLink article={article} isRead={isRead} onOpen={onOpen} />
                      </div>
                      {article.summary && <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#526878] dark:text-[#8da1b0]">{article.summary}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {data?.truncated && <p className="border-t border-[#bdcad3] px-3 py-2 text-[11px] text-[#526878] dark:border-[#294154] dark:text-[#8da1b0]">Kuvatakse piiratud osa selle loo kajastustest.</p>}

      {!data && !loading && fallback.length > 0 && (
        <RelatedCoveragePanel id={`${id}-fallback`} title={title} related={fallback} nowMs={nowMs} isRead={isRead} onOpen={onOpen} />
      )}
    </section>
  );
}
