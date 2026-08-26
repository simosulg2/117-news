import type {
  Category,
  NewsArticle,
  NewsItem,
  NewsResponse,
  NewsStoryArticle,
  NewsStoryEvent,
  NewsStoryPreview,
} from "@/lib/types";

export function relativeNewsTime(value: string, nowMs = Date.now()): string {
  const elapsedMinutes = Math.max(0, Math.round((nowMs - Date.parse(value)) / 60_000));
  if (elapsedMinutes < 1) return "praegu";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours} t`;
  return `${Math.floor(hours / 24)} p`;
}

export function normalizeNewsSearch(value: string): string {
  return value.toLocaleLowerCase("et-EE").normalize("NFKD").replace(/\p{M}/gu, "");
}

export function relatedNewsItems(item: NewsItem): NewsArticle[] {
  return item.related ?? [];
}

export function newsRowId(item: NewsItem): string {
  return item.story?.id ? `story:${item.story.id}` : `article:${item.id}`;
}

export function newsStoryPreviews(data: NewsResponse | null): NewsStoryPreview[] {
  if (!data) return [];
  const previews = new Map<string, NewsStoryPreview>();
  const collections = [data.items, ...Object.values(data.itemsByCategory ?? {})];

  for (const item of collections.flat()) {
    if (!item.story) continue;
    const previous = previews.get(item.story.id);
    if (!previous || item.story.version > previous.version) {
      previews.set(item.story.id, item.story);
    }
  }
  return [...previews.values()];
}

function validTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function articleTimelineTimestamp(article: NewsStoryArticle): number {
  return validTimestamp(article.publishedAt)
    ?? validTimestamp(article.firstSeenAt)
    ?? Number.POSITIVE_INFINITY;
}

function eventTimelineTimestamp(event: NewsStoryEvent): number {
  const eventTimestamp = validTimestamp(event.publishedAt);
  if (eventTimestamp !== null) return eventTimestamp;
  return Math.min(...event.articles.map(articleTimelineTimestamp), Number.POSITIVE_INFINITY);
}

export function orderedNewsStoryArticles(
  articles: readonly NewsStoryArticle[],
): NewsStoryArticle[] {
  return [...articles].sort((left, right) =>
    articleTimelineTimestamp(left) - articleTimelineTimestamp(right)
      || left.id.localeCompare(right.id));
}

export function orderedNewsStoryEvents(events: readonly NewsStoryEvent[]): NewsStoryEvent[] {
  return [...events].sort((left, right) =>
    eventTimelineTimestamp(left) - eventTimelineTimestamp(right)
      || left.id.localeCompare(right.id));
}

export function filterNewsItems(
  data: NewsResponse | null,
  category: Category,
  query: string,
): NewsItem[] {
  if (!data) return [];

  const needle = normalizeNewsSearch(query.trim());
  const availableItems = category === "Kõik"
    ? data.items
    : data.itemsByCategory?.[category] ?? data.items;

  return availableItems.filter((item) => {
    if (category !== "Kõik" && item.category !== category) return false;
    if (!needle) return true;

    const relatedSearchText = relatedNewsItems(item)
      .map((relatedItem) => `${relatedItem.title} ${relatedItem.summary} ${relatedItem.category} ${relatedItem.source}`)
      .join(" ");

    return normalizeNewsSearch(
      `${item.title} ${item.summary} ${item.category} ${item.source} ${relatedSearchText}`,
    ).includes(needle);
  });
}

export function nextNewsItemIndex(
  direction: "next" | "previous",
  currentIndex: number,
  itemCount: number,
): number {
  if (itemCount <= 0) return -1;
  if (direction === "next") {
    return currentIndex < 0 ? 0 : Math.min(currentIndex + 1, itemCount - 1);
  }
  return currentIndex < 0 ? itemCount - 1 : Math.max(currentIndex - 1, 0);
}
