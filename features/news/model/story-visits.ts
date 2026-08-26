import type { NewsStoryPreview } from "@/lib/types";

export const STORY_VISITS_STORAGE_KEY = "117-news-story-visits-v1";
export const STORY_VISIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const MAX_STORY_VISITS = 500;

export type StoryVisit = {
  storyVersion: number;
  latestArticleId: string;
  seenAt: number;
};

export type StoryVisitEnvelope = {
  schemaVersion: 1;
  lastVisitAt: number;
  stories: Record<string, StoryVisit>;
};

function validVisit(value: unknown, cutoff: number): value is StoryVisit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const visit = value as Partial<StoryVisit>;
  return Number.isInteger(visit.storyVersion)
    && (visit.storyVersion ?? -1) >= 0
    && typeof visit.latestArticleId === "string"
    && visit.latestArticleId.trim().length > 0
    && typeof visit.seenAt === "number"
    && Number.isFinite(visit.seenAt)
    && visit.seenAt >= cutoff;
}

export function pruneStoryVisits(
  value: unknown,
  nowMs = Date.now(),
): StoryVisitEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Partial<StoryVisitEnvelope>;
  if (
    envelope.schemaVersion !== 1
    || typeof envelope.lastVisitAt !== "number"
    || !Number.isFinite(envelope.lastVisitAt)
    || !envelope.stories
    || typeof envelope.stories !== "object"
    || Array.isArray(envelope.stories)
  ) return null;

  const cutoff = nowMs - STORY_VISIT_RETENTION_MS;
  const entries = Object.entries(envelope.stories)
    .filter((entry): entry is [string, StoryVisit] => Boolean(entry[0]) && validVisit(entry[1], cutoff))
    .sort((left, right) => right[1].seenAt - left[1].seenAt || left[0].localeCompare(right[0]))
    .slice(0, MAX_STORY_VISITS);

  return {
    schemaVersion: 1,
    lastVisitAt: envelope.lastVisitAt,
    stories: Object.fromEntries(entries),
  };
}

export function parseStoryVisits(
  value: string | null,
  nowMs = Date.now(),
): StoryVisitEnvelope | null {
  if (!value) return null;
  try {
    return pruneStoryVisits(JSON.parse(value) as unknown, nowMs);
  } catch {
    return null;
  }
}

export function storyChangedSinceVisit(
  story: NewsStoryPreview,
  visit: StoryVisit | undefined,
): boolean {
  if (!visit) return true;
  if (story.version !== visit.storyVersion) return story.version > visit.storyVersion;
  return story.latestArticleId !== visit.latestArticleId;
}

export function storyArticleIsNew(
  addedVersion: number,
  visit: StoryVisit | undefined,
): boolean {
  return !visit || addedVersion > visit.storyVersion;
}

export function recordStoryVisits(
  current: StoryVisitEnvelope | null,
  stories: readonly NewsStoryPreview[],
  nowMs = Date.now(),
): StoryVisitEnvelope {
  const nextStories = { ...(pruneStoryVisits(current, nowMs)?.stories ?? {}) };

  for (const story of stories) {
    const previous = nextStories[story.id];
    if (previous && previous.storyVersion > story.version) continue;
    nextStories[story.id] = {
      storyVersion: story.version,
      latestArticleId: story.latestArticleId,
      seenAt: nowMs,
    };
  }

  return pruneStoryVisits({
    schemaVersion: 1,
    lastVisitAt: nowMs,
    stories: nextStories,
  }, nowMs) ?? {
    schemaVersion: 1,
    lastVisitAt: nowMs,
    stories: {},
  };
}
