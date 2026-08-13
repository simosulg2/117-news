export const STORY_GROUPING_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const STORY_GROUPING_THRESHOLD = 0.82;

const EDITORIAL_PREFIXES = [
  "fotod ja video",
  "video ja fotod",
  "fotogalerii",
  "otseblogi",
  "suur lugu",
  "täiendatud",
  "reportaaž",
  "kommentaar",
  "intervjuu",
  "juhtkiri",
  "analüüs",
  "arvamus",
  "galerii",
  "podcast",
  "pildid",
  "fotod",
  "video",
  "kuula",
  "vaata",
  "blogi",
  "otse",
  "uudis",
] as const;

const PREFIX_PATTERN = new RegExp(
  `^\\s*(?:[\\[(]\\s*)?(?:${EDITORIAL_PREFIXES
    .map((prefix) => prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\s+/g, "\\s+"))
    .join("|")})(?:\\s*[\\])])?\\s*(?::|[|\u2013\u2014-]|[>\u00bb\u203a\u27e9])\\s*`,
  "iu",
);

// These words are too broad to prove that two otherwise-similar headlines
// describe the same event. They still contribute to the overall title score.
const NON_ANCHOR_WORDS = new Set([
  "aga",
  "alla",
  "arvamus",
  "eesti",
  "eestis",
  "eile",
  "enne",
  "err",
  "hakkab",
  "ilma",
  "juba",
  "juurde",
  "juures",
  "järgi",
  "kohta",
  "koos",
  "kuid",
  "kõik",
  "läheb",
  "meie",
  "mida",
  "miks",
  "mille",
  "nende",
  "ning",
  "nüüd",
  "olema",
  "olnud",
  "pärast",
  "postimees",
  "saab",
  "seda",
  "selle",
  "siis",
  "sõnul",
  "teatas",
  "toimub",
  "tuleb",
  "täna",
  "uudis",
  "uudised",
  "vahel",
  "vastu",
  "veel",
  "vaid",
  "üks",
  "ütles",
  "üle",
  "uued",
  "uue",
  "vaata",
  "või",
  "jaoks",
  "järel",
  "kuni",
  "kelle",
  "millal",
  "sellest",
  "selles",
  "tema",
  "näiteks",
  "samuti",
  "ja",
  "et",
  "kui",
  "kas",
  "kes",
  "mis",
  "see",
  "need",
  "nad",
  "oli",
  "olid",
  "pole",
  "on",
  "ka",
  "ei",
]);

/** Removes repeatable labels such as "OTSE:" and "GALERII |" from a title. */
export function stripEditorialPrefixes(title: string): string {
  let stripped = title.normalize("NFKC").trim();

  // A feed occasionally stacks labels (for example "OTSE | VIDEO:").
  for (let index = 0; index < 4; index += 1) {
    const next = stripped.replace(PREFIX_PATTERN, "");
    if (next === stripped) break;
    stripped = next.trim();
  }

  return stripped;
}

/** Produces the canonical text used by both similarity algorithms. */
export function normalizeStoryTitle(title: string): string {
  return stripEditorialPrefixes(title)
    .toLocaleLowerCase("et")
    .replace(/&/gu, " ja ")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function tokenizeStoryTitle(title: string): string[] {
  const normalized = normalizeStoryTitle(title);
  return normalized ? normalized.split(" ") : [];
}

function tokenSetSorensenDice(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) {
    return left.size === right.size ? 1 : 0;
  }

  let shared = 0;
  for (const token of left) {
    if (right.has(token)) shared += 1;
  }

  return (2 * shared) / (left.size + right.size);
}

/** Token-set Sørensen–Dice similarity, insensitive to word order. */
export function tokenSorensenDiceSimilarity(leftTitle: string, rightTitle: string): number {
  const left = new Set(tokenizeStoryTitle(leftTitle));
  const right = new Set(tokenizeStoryTitle(rightTitle));
  return tokenSetSorensenDice(left, right);
}

function levenshteinDistance(left: string, right: string): number {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);

  if (leftCharacters.length > rightCharacters.length) {
    return levenshteinDistance(right, left);
  }
  if (leftCharacters.length === 0) return rightCharacters.length;

  let previous = Array.from({ length: leftCharacters.length + 1 }, (_, index) => index);

  for (let rightIndex = 1; rightIndex <= rightCharacters.length; rightIndex += 1) {
    const current = new Array<number>(leftCharacters.length + 1);
    current[0] = rightIndex;

    for (let leftIndex = 1; leftIndex <= leftCharacters.length; leftIndex += 1) {
      const substitutionCost = leftCharacters[leftIndex - 1] === rightCharacters[rightIndex - 1] ? 0 : 1;
      current[leftIndex] = Math.min(
        current[leftIndex - 1] + 1,
        previous[leftIndex] + 1,
        previous[leftIndex - 1] + substitutionCost,
      );
    }

    previous = current;
  }

  return previous[leftCharacters.length];
}

/** Character similarity after normalization: 1 is identical and 0 is wholly different. */
export function normalizedLevenshteinSimilarity(leftTitle: string, rightTitle: string): number {
  const left = normalizeStoryTitle(leftTitle);
  const right = normalizeStoryTitle(rightTitle);
  return normalizedTextLevenshteinSimilarity(left, right);
}

function normalizedTextLevenshteinSimilarity(left: string, right: string): number {
  if (left === right) return 1;

  const longestLength = Math.max(Array.from(left).length, Array.from(right).length);
  if (longestLength === 0) return 1;

  return 1 - levenshteinDistance(left, right) / longestLength;
}

export function storyTitleSimilarity(leftTitle: string, rightTitle: string): number {
  return (
    0.65 * tokenSorensenDiceSimilarity(leftTitle, rightTitle)
    + 0.35 * normalizedLevenshteinSimilarity(leftTitle, rightTitle)
  );
}

function originalCaseAnchorTokens(title: string): Set<string> {
  const words = stripEditorialPrefixes(title).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  const anchors = new Set<string>();

  words.forEach((word, index) => {
    const isAcronym = /^[\p{Lu}\p{N}]{2,}$/u.test(word);
    // Ignore ordinary sentence capitalization, but retain names elsewhere.
    const isLikelyName = index > 0 && /^\p{Lu}[\p{L}\p{M}]{2,}$/u.test(word);
    if (isAcronym || isLikelyName) anchors.add(word.toLocaleLowerCase("et"));
  });

  return anchors;
}

export type TitleFingerprint = {
  normalized: string;
  numbers: Set<string>;
  tokens: Set<string>;
  properNames: Set<string>;
};

export function createTitleFingerprint(title: string): TitleFingerprint {
  const normalized = normalizeStoryTitle(title);
  const tokens = new Set(normalized ? normalized.split(" ") : []);
  return {
    normalized,
    numbers: new Set([...tokens].filter((token) => /^\d+(?:[.,]\d+)?$/u.test(token))),
    tokens,
    properNames: originalCaseAnchorTokens(title),
  };
}

export function fingerprintsHaveConflictingNumbers(left: TitleFingerprint, right: TitleFingerprint): boolean {
  if (left.numbers.size === 0 || right.numbers.size === 0) return false;
  return ![...left.numbers].some((number) => right.numbers.has(number));
}

export function fingerprintsShareMeaningfulAnchor(
  left: TitleFingerprint,
  right: TitleFingerprint,
): boolean {
  for (const token of left.tokens) {
    if (!right.tokens.has(token)) continue;
    if (/^\d+(?:[.,]\d+)?$/u.test(token)) return true;
    if (left.properNames.has(token) && right.properNames.has(token)) return true;
    if (token.length >= 4 && !NON_ANCHOR_WORDS.has(token)) return true;
  }

  return false;
}

export function fingerprintSimilarity(left: TitleFingerprint, right: TitleFingerprint): number {
  return (
    0.65 * tokenSetSorensenDice(left.tokens, right.tokens)
    + 0.35 * normalizedTextLevenshteinSimilarity(left.normalized, right.normalized)
  );
}

/**
 * Requires at least one shared number, likely name/acronym, or substantive word.
 * This deliberately errs toward leaving a duplicate visible instead of merging
 * two unrelated stories under a generic headline.
 */
export function hasSharedMeaningfulAnchor(leftTitle: string, rightTitle: string): boolean {
  return fingerprintsShareMeaningfulAnchor(
    createTitleFingerprint(leftTitle),
    createTitleFingerprint(rightTitle),
  );
}
