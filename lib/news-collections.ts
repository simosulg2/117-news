import { groupNewsItems } from "./group-stories.ts";
import {
  FEED_CATEGORIES,
  type NewsArticle,
  type NewsItem,
  type NewsItemsByCategory,
} from "./types.ts";

export const MAX_NEWS_ITEMS = 117;

export type NewsCollections = {
  items: NewsItem[];
  itemsByCategory: NewsItemsByCategory;
};

export function buildNewsCollections(
  articles: NewsArticle[],
  now: number | Date,
  limit = MAX_NEWS_ITEMS,
): NewsCollections {
  const groupAndLimit = (candidates: NewsArticle[]) => groupNewsItems(candidates, now).slice(0, limit);
  const itemsByCategory = Object.fromEntries(
    FEED_CATEGORIES.map((category) => [
      category,
      groupAndLimit(articles.filter((article) => article.category === category)),
    ]),
  ) as NewsItemsByCategory;

  return {
    items: groupAndLimit(articles),
    itemsByCategory,
  };
}
