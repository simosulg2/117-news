import { groupNewsItems } from "./group-stories.ts";
import {
  FEED_CATEGORIES,
  type NewsArticle,
  type NewsItem,
  type NewsItemsByCategory,
  type NewsStoryPreview,
} from "./types.ts";

export const MAX_NEWS_ITEMS = 117;

export type NewsCollections = {
  items: NewsItem[];
  itemsByCategory: NewsItemsByCategory;
};

export type NewsStoryAssociation = {
  coverageId: string;
  story: NewsStoryPreview;
};

function articleTime(article: NewsArticle): number {
  if (!article.publishedAt) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(article.publishedAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function persistentStoryItems(
  candidates: NewsArticle[],
  associations: ReadonlyMap<string, NewsStoryAssociation>,
): { items: NewsItem[]; unassociated: NewsArticle[] } {
  const stories = new Map<string, NewsArticle[]>();
  const unassociated: NewsArticle[] = [];

  for (const article of candidates) {
    const association = associations.get(article.id);
    if (!association) {
      unassociated.push(article);
      continue;
    }
    const existing = stories.get(association.story.id);
    if (existing) existing.push(article);
    else stories.set(association.story.id, [article]);
  }

  const items = [...stories.values()].map((articles) => {
    const ranked = [...articles].sort((left, right) =>
      articleTime(right) - articleTime(left) || left.id.localeCompare(right.id));
    const primary = ranked[0];
    const primaryAssociation = associations.get(primary.id)!;
    const related = ranked.filter((article) =>
      article.id !== primary.id
      && associations.get(article.id)?.coverageId === primaryAssociation.coverageId);
    return { ...primary, related, story: primaryAssociation.story };
  });

  return { items, unassociated };
}

function itemTime(item: NewsItem): number {
  return articleTime(item);
}

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

export function buildPersistentNewsCollections(
  articles: NewsArticle[],
  associations: ReadonlyMap<string, NewsStoryAssociation>,
  now: number | Date,
  limit = MAX_NEWS_ITEMS,
): NewsCollections {
  const groupAndLimit = (candidates: NewsArticle[]) => {
    const persistent = persistentStoryItems(candidates, associations);
    return [
      ...persistent.items,
      ...groupNewsItems(persistent.unassociated, now),
    ].sort((left, right) => itemTime(right) - itemTime(left) || left.id.localeCompare(right.id))
      .slice(0, limit);
  };
  const itemsByCategory = Object.fromEntries(
    FEED_CATEGORIES.map((category) => [
      category,
      groupAndLimit(articles.filter((article) => article.category === category)),
    ]),
  ) as NewsItemsByCategory;

  return { items: groupAndLimit(articles), itemsByCategory };
}
