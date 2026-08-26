import {
  createTitleFingerprint,
  fingerprintSimilarity,
  stripEditorialPrefixes,
} from "../../../lib/story-title-similarity.ts";
import type {
  FeedCategory,
  NewsArticle,
  NewsSource,
  NewsStoryMatchReason,
} from "../../../lib/types.ts";
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
export const NEWS_STORY_ACTIVE_WINDOW_MS = 72 * HOUR_MS;
export const NEWS_STORY_RETENTION_MS = 30 * DAY_MS;
export const NEWS_STORY_CROSS_SOURCE_THRESHOLD = 0.52;
export const NEWS_STORY_SAME_SOURCE_THRESHOLD = 0.63;
export const MAX_STORY_MATCH_REPRESENTATIVES = 12;
const GENERIC_ANCHORS = new Set([
  "aga", "alla", "arutab", "arutas", "avab", "eesti", "eestis", "eile", "enne",
  "hakkab", "homme", "ilma", "ja", "juba", "juurde", "jargi", "ka", "kas", "kes",
  "kohta", "koik", "kuid", "kui", "laheb", "mida", "miks", "mille", "mis", "nad",
  "nende", "ning", "nuud", "oli", "olid", "olnud", "on", "parast", "pole", "saab",
  "sai", "seda", "see", "selle", "selgitab", "selgitas", "siis", "sonul", "teatab",
  "teatas", "teeb", "tegi", "tema", "toimub", "toimus", "tuleb", "tana", "uudis",
  "uudised", "uue", "uued", "uus", "vahel", "vaid", "vastu", "veel", "voi", "utles",
  "ule", "aasta", "aastal", "err", "postimees", "video", "fotod", "galerii", "otse",
]);
export type StoryEvolutionArticle = Pick<
  NewsArticle,
  "id" | "title" | "summary" | "publishedAt" | "category" | "source"
>;
export type EvolutionFingerprint = {
  articleId: string;
  category: FeedCategory;
  source: NewsSource;
  publishedTimestamp: number | null;
  titleFingerprint: ReturnType<typeof createTitleFingerprint>;
  titleAnchors: ReadonlySet<string>;
  summaryAnchors: ReadonlySet<string>;
  contextAnchors: ReadonlySet<string>;
  names: ReadonlySet<string>;
  numbers: ReadonlySet<string>;
};
export type StoryEvolutionCandidate = {
  storyId: string;
  seed: StoryEvolutionArticle;
  representatives: readonly StoryEvolutionArticle[];
  latestPublishedAt: string | null;
};
export type StoryEvolutionPairScore = {
  matches: boolean;
  matchedArticleId: string;
  score: number;
  threshold: number;
  reasons: NewsStoryMatchReason[];
  sharedAnchorCount: number;
  timeGapMs: number;
};
export type StoryEvolutionMatch = StoryEvolutionPairScore & {
  storyId: string;
};
function normalizeWord(value: string): string {
  return value
    .toLocaleLowerCase("et-EE")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
}
function words(value: string): string[] {
  return normalizeWord(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}
function anchorKey(value: string): string {
  return value.length >= 7 ? value.slice(0, 6) : value;
}
function nameKeys(title: string): Set<string> {
  const result = new Set<string>();
  const titleWords = stripEditorialPrefixes(title).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  for (const word of titleWords) {
    const isAcronym = /^[\p{Lu}\p{N}]{2,}$/u.test(word);
    const isTitleCase = /^\p{Lu}[\p{Ll}\p{M}]{2,}$/u.test(word);
    if (isAcronym || isTitleCase) result.add(anchorKey(normalizeWord(word)));
  }
  return result;
}
function anchorKeys(value: string, excludedNames: ReadonlySet<string>): Set<string> {
  const result = new Set<string>();
  for (const word of words(value)) {
    if (word.length < 4 || /^\d+(?:[.,]\d+)?$/u.test(word) || GENERIC_ANCHORS.has(word)) continue;
    const key = anchorKey(word);
    if (!excludedNames.has(key)) result.add(key);
  }
  return result;
}
function union(left: ReadonlySet<string>, right: ReadonlySet<string>): Set<string> {
  return new Set([...left, ...right]);
}
function intersection(left: ReadonlySet<string>, right: ReadonlySet<string>): Set<string> {
  return new Set([...left].filter((value) => right.has(value)));
}
function dice(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  return (2 * intersection(left, right).size) / (left.size + right.size);
}
function parsedTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
function resolvedNow(now: number | Date): number {
  const timestamp = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(timestamp)) throw new RangeError("Story matching timestamp must be valid");
  return timestamp;
}
function roundedScore(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1_000) / 1_000;
}
function lexicalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
export function createEvolutionFingerprint(article: StoryEvolutionArticle): EvolutionFingerprint {
  const names = nameKeys(article.title);
  const titleAnchors = anchorKeys(stripEditorialPrefixes(article.title), names);
  const summaryAnchors = anchorKeys(article.summary, names);
  const titleFingerprint = createTitleFingerprint(article.title);
  return {
    articleId: article.id,
    category: article.category,
    source: article.source,
    publishedTimestamp: parsedTimestamp(article.publishedAt),
    titleFingerprint,
    titleAnchors,
    summaryAnchors,
    contextAnchors: union(titleAnchors, summaryAnchors),
    names,
    numbers: titleFingerprint.numbers,
  };
}
export type EvolutionNumberRelationship = "none" | "same" | "overlap" | "changed";
export function evolutionNumberRelationship(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): EvolutionNumberRelationship {
  if (left.size === 0 || right.size === 0) return "none";
  const shared = intersection(left, right).size;
  if (shared === 0) return "changed";
  if (shared === left.size && shared === right.size) return "same";
  return "overlap";
}
function hasStableEvidence(
  fingerprint: EvolutionFingerprint,
  names: ReadonlySet<string>,
  anchors: ReadonlySet<string>,
): boolean {
  const sharedNames = intersection(fingerprint.names, names).size;
  const sharedAnchors = intersection(fingerprint.contextAnchors, anchors).size;
  return sharedAnchors >= 2 || (sharedNames >= 1 && sharedAnchors >= 1);
}
export function scoreStoryEvolutionPair(
  candidate: StoryEvolutionArticle,
  representative: StoryEvolutionArticle,
  now: number | Date,
): StoryEvolutionPairScore {
  const left = createEvolutionFingerprint(candidate);
  const right = createEvolutionFingerprint(representative);
  const threshold = left.source === right.source
    ? NEWS_STORY_SAME_SOURCE_THRESHOLD
    : NEWS_STORY_CROSS_SOURCE_THRESHOLD;
  const rejected = (timeGapMs = Number.POSITIVE_INFINITY): StoryEvolutionPairScore => ({
    matches: false,
    matchedArticleId: representative.id,
    score: 0,
    threshold,
    reasons: [],
    sharedAnchorCount: 0,
    timeGapMs,
  });

  if (left.category !== right.category) return rejected();
  if (left.publishedTimestamp === null || right.publishedTimestamp === null) return rejected();
  const nowTimestamp = resolvedNow(now);
  if (left.publishedTimestamp > nowTimestamp || right.publishedTimestamp > nowTimestamp) return rejected();
  const timeGapMs = Math.abs(left.publishedTimestamp - right.publishedTimestamp);
  if (timeGapMs > NEWS_STORY_ACTIVE_WINDOW_MS) return rejected(timeGapMs);

  const sharedNames = intersection(left.names, right.names);
  const sharedAnchors = intersection(left.contextAnchors, right.contextAnchors);
  if (!hasStableEvidence(left, right.names, right.contextAnchors)) return rejected(timeGapMs);

  const titleSimilarity = fingerprintSimilarity(left.titleFingerprint, right.titleFingerprint);
  const summarySimilarity = dice(left.summaryAnchors, right.summaryAnchors);
  const anchorCoverage = Math.min(1, sharedAnchors.size / 3);
  const nameCoverage = Math.min(1, sharedNames.size / 2);
  const timeProximity = 1 - timeGapMs / NEWS_STORY_ACTIVE_WINDOW_MS;
  const numberRelationship = evolutionNumberRelationship(left.numbers, right.numbers);
  const score = roundedScore(
    0.35 * titleSimilarity
      + 0.3 * summarySimilarity
      + 0.2 * anchorCoverage
      + 0.1 * timeProximity
      + 0.05 * nameCoverage
      - (numberRelationship === "changed" ? 0.1 : 0),
  );
  const reasons: NewsStoryMatchReason[] = [];
  if (titleSimilarity >= 0.82 && numberRelationship !== "changed") reasons.push("strict_title");
  if (sharedNames.size > 0) reasons.push("shared_name");
  reasons.push("shared_anchors");
  if (titleSimilarity >= 0.35) reasons.push("title_similarity");
  if (summarySimilarity >= 0.25) reasons.push("summary_similarity");
  reasons.push("time_proximity");
  if (numberRelationship === "changed") reasons.push("numbers_changed");
  return {
    matches: score >= threshold,
    matchedArticleId: representative.id,
    score,
    threshold,
    reasons,
    sharedAnchorCount: sharedAnchors.size,
    timeGapMs,
  };
}
function uniqueRepresentatives(story: StoryEvolutionCandidate): StoryEvolutionArticle[] {
  const byId = new Map<string, StoryEvolutionArticle>();
  for (const article of [story.seed, ...story.representatives]) byId.set(article.id, article);
  return [...byId.values()]
    .sort((left, right) =>
      (parsedTimestamp(right.publishedAt) ?? Number.NEGATIVE_INFINITY)
        - (parsedTimestamp(left.publishedAt) ?? Number.NEGATIVE_INFINITY)
      || lexicalCompare(left.id, right.id),
    )
    .slice(0, MAX_STORY_MATCH_REPRESENTATIVES);
}
function storyCore(story: StoryEvolutionCandidate): { names: Set<string>; anchors: Set<string> } {
  const seed = createEvolutionFingerprint(story.seed);
  const names = new Set(seed.names);
  const anchors = new Set(seed.contextAnchors);
  const nameCounts = new Map<string, number>();
  const anchorCounts = new Map<string, number>();
  for (const article of uniqueRepresentatives(story)) {
    const fingerprint = createEvolutionFingerprint(article);
    for (const value of fingerprint.names) nameCounts.set(value, (nameCounts.get(value) ?? 0) + 1);
    for (const value of fingerprint.contextAnchors) {
      anchorCounts.set(value, (anchorCounts.get(value) ?? 0) + 1);
    }
  }
  for (const [value, count] of nameCounts) if (count >= 2) names.add(value);
  for (const [value, count] of anchorCounts) if (count >= 2) anchors.add(value);
  return { names, anchors };
}
function compareMatches(left: StoryEvolutionMatch, right: StoryEvolutionMatch): number {
  return right.score - left.score
    || right.sharedAnchorCount - left.sharedAnchorCount
    || left.timeGapMs - right.timeGapMs
    || lexicalCompare(left.storyId, right.storyId);
}
export function scoreStoryEvolutionCandidate(
  article: StoryEvolutionArticle,
  story: StoryEvolutionCandidate,
  now: number | Date,
): StoryEvolutionMatch | null {
  const fingerprint = createEvolutionFingerprint(article);
  if (fingerprint.category !== story.seed.category) return null;
  if (fingerprint.publishedTimestamp === null || fingerprint.publishedTimestamp > resolvedNow(now)) return null;
  const latestTimestamp = parsedTimestamp(story.latestPublishedAt);
  if (
    latestTimestamp === null
    || Math.abs(fingerprint.publishedTimestamp - latestTimestamp) > NEWS_STORY_ACTIVE_WINDOW_MS
  ) return null;
  const core = storyCore(story);
  if (!hasStableEvidence(fingerprint, core.names, core.anchors)) return null;

  const matches = uniqueRepresentatives(story)
    .map((representative) => ({
      storyId: story.storyId,
      ...scoreStoryEvolutionPair(article, representative, now),
    }))
    .filter((match) => match.matches)
    .sort(compareMatches);
  return matches[0] ?? null;
}
export function selectStoryEvolutionMatch(
  article: StoryEvolutionArticle,
  stories: readonly StoryEvolutionCandidate[],
  now: number | Date,
): StoryEvolutionMatch | null {
  return stories
    .map((story) => scoreStoryEvolutionCandidate(article, story, now))
    .filter((match): match is StoryEvolutionMatch => match !== null)
    .sort(compareMatches)[0] ?? null;
}
export function newStoryAssociation(): {
  score: 1;
  reasons: ["new_story"];
} {
  return { score: 1, reasons: ["new_story"] };
}
