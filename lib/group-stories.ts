import type { NewsArticle, NewsItem } from "./types.ts";
import {
  createTitleFingerprint,
  fingerprintSimilarity,
  fingerprintsHaveConflictingNumbers,
  fingerprintsShareMeaningfulAnchor,
  STORY_GROUPING_THRESHOLD,
  STORY_GROUPING_WINDOW_MS,
  type TitleFingerprint,
} from "./story-title-similarity.ts";

export {
  hasSharedMeaningfulAnchor,
  normalizeStoryTitle,
  normalizedLevenshteinSimilarity,
  STORY_GROUPING_THRESHOLD,
  STORY_GROUPING_WINDOW_MS,
  storyTitleSimilarity,
  stripEditorialPrefixes,
  tokenizeStoryTitle,
  tokenSorensenDiceSimilarity,
} from "./story-title-similarity.ts";

function resolveNow(now: number | Date): number {
  const timestamp = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(timestamp)) throw new RangeError("Grouping timestamp must be a valid date");
  return timestamp;
}

function articleTimestamp(article: NewsArticle): number | null {
  if (!article.publishedAt) return null;
  const timestamp = Date.parse(article.publishedAt);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isWithinStoryGroupingWindow(
  publishedAt: string | null,
  now: number | Date,
): boolean {
  if (!publishedAt) return false;
  const publishedTimestamp = Date.parse(publishedAt);
  if (!Number.isFinite(publishedTimestamp)) return false;
  const nowTimestamp = resolveNow(now);
  return publishedTimestamp <= nowTimestamp
    && publishedTimestamp >= nowTimestamp - STORY_GROUPING_WINDOW_MS;
}

type RankedArticle = {
  article: NewsArticle;
  fingerprint: TitleFingerprint;
  originalIndex: number;
  publishedTimestamp: number | null;
  isRecent: boolean;
};

type WorkingGroup = {
  primary: RankedArticle;
  related: RankedArticle[];
  sources: Set<NewsArticle["source"]>;
};

/** Groups recent cross-source duplicates without transitive chaining. */
export function groupNewsItems(items: NewsArticle[], now: number | Date): NewsItem[] {
  const nowTimestamp = resolveNow(now);
  const ranked: RankedArticle[] = items
    .map((article, originalIndex) => {
      const publishedTimestamp = articleTimestamp(article);
      return {
        article,
        fingerprint: createTitleFingerprint(article.title),
        originalIndex,
        publishedTimestamp,
        isRecent: publishedTimestamp !== null
          && publishedTimestamp <= nowTimestamp
          && publishedTimestamp >= nowTimestamp - STORY_GROUPING_WINDOW_MS,
      };
    })
    .sort((left, right) => {
      const timeDifference = (right.publishedTimestamp ?? Number.NEGATIVE_INFINITY)
        - (left.publishedTimestamp ?? Number.NEGATIVE_INFINITY);
      return timeDifference || left.originalIndex - right.originalIndex;
    });

  const groups: WorkingGroup[] = [];
  for (const candidate of ranked) {
    const matchingGroup = candidate.isRecent
      ? groups.find((group) => {
          if (!group.primary.isRecent || group.sources.has(candidate.article.source)) return false;
          if (fingerprintsHaveConflictingNumbers(group.primary.fingerprint, candidate.fingerprint)) {
            return false;
          }
          if (!fingerprintsShareMeaningfulAnchor(group.primary.fingerprint, candidate.fingerprint)) {
            return false;
          }
          return fingerprintSimilarity(group.primary.fingerprint, candidate.fingerprint)
            >= STORY_GROUPING_THRESHOLD;
        })
      : undefined;
    if (matchingGroup) {
      matchingGroup.related.push(candidate);
      matchingGroup.sources.add(candidate.article.source);
    } else {
      groups.push({ primary: candidate, related: [], sources: new Set([candidate.article.source]) });
    }
  }

  return groups.map(({ primary, related }) => ({
    ...primary.article,
    related: related.map(({ article }) => article),
  }));
}
