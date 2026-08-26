import {
  createTitleFingerprint,
  stripEditorialPrefixes,
} from "../../../lib/story-title-similarity.ts";
import type { NewsArticle, NewsSource } from "../../../lib/types.ts";

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
  category: NewsArticle["category"];
  source: NewsSource;
  publishedTimestamp: number | null;
  titleFingerprint: ReturnType<typeof createTitleFingerprint>;
  titleAnchors: ReadonlySet<string>;
  summaryAnchors: ReadonlySet<string>;
  contextAnchors: ReadonlySet<string>;
  names: ReadonlySet<string>;
  numbers: ReadonlySet<string>;
};

export type EvolutionPairEvidence = {
  crossNames: Set<string>;
  sharedAnchors: Set<string>;
  sharedNames: Set<string>;
  sharedTitleAnchors: Set<string>;
  summarySimilarity: number;
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

export function setUnion(left: ReadonlySet<string>, right: ReadonlySet<string>): Set<string> {
  return new Set([...left, ...right]);
}

export function setIntersection(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): Set<string> {
  return new Set([...left].filter((value) => right.has(value)));
}

function setDice(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  return (2 * setIntersection(left, right).size) / (left.size + right.size);
}

function parsedTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
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
    contextAnchors: setUnion(titleAnchors, summaryAnchors),
    names,
    numbers: titleFingerprint.numbers,
  };
}

export function evolutionPairEvidence(
  left: EvolutionFingerprint,
  right: EvolutionFingerprint,
): EvolutionPairEvidence {
  return {
    crossNames: setUnion(
      setIntersection(left.names, right.contextAnchors),
      setIntersection(right.names, left.contextAnchors),
    ),
    sharedAnchors: setIntersection(left.contextAnchors, right.contextAnchors),
    sharedNames: setIntersection(left.names, right.names),
    sharedTitleAnchors: setIntersection(left.titleAnchors, right.titleAnchors),
    summarySimilarity: setDice(left.summaryAnchors, right.summaryAnchors),
  };
}
