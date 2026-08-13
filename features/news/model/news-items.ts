import type { Category, NewsArticle, NewsItem, NewsResponse } from "@/lib/types";

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
