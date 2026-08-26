"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { newsStoryPreviews } from "@/features/news/model/news-items";
import {
  parseStoryVisits,
  recordStoryVisits,
  STORY_VISITS_STORAGE_KEY,
  storyArticleIsNew,
  storyChangedSinceVisit,
  type StoryVisit,
  type StoryVisitEnvelope,
} from "@/features/news/model/story-visits";
import type { NewsResponse, NewsStoryPreview } from "@/lib/types";

function writeVisits(value: StoryVisitEnvelope): void {
  try {
    localStorage.setItem(STORY_VISITS_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Story history remains usable when browser storage is unavailable.
  }
}

export function useStoryVisits(data: NewsResponse | null) {
  const previews = useMemo(() => newsStoryPreviews(data), [data]);
  const persistedRef = useRef<StoryVisitEnvelope | null>(null);
  const [baseline, setBaseline] = useState<StoryVisitEnvelope | null>();
  const [dismissed, setDismissed] = useState<Record<string, StoryVisit>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stored: StoryVisitEnvelope | null = null;
    try {
      stored = parseStoryVisits(localStorage.getItem(STORY_VISITS_STORAGE_KEY));
    } catch {
      // Treat inaccessible storage as a first visit.
    }
    persistedRef.current = stored;
    setBaseline(stored);
    setLoaded(true);

    function handleStorage(event: StorageEvent) {
      if (event.key !== STORY_VISITS_STORAGE_KEY) return;
      const next = parseStoryVisits(event.newValue);
      persistedRef.current = next;
      setBaseline(next);
      setDismissed({});
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    const next = recordStoryVisits(persistedRef.current, previews);
    persistedRef.current = next;
    writeVisits(next);

    // A first visit establishes an in-memory baseline without marking every
    // currently visible story as new. Later refreshes still compare to it.
    if (baseline === null) setBaseline(next);
  }, [baseline, data, loaded, previews]);

  const isStoryNew = useCallback((story: NewsStoryPreview): boolean => {
    if (!baseline) return false;
    const dismissedVisit = dismissed[story.id];
    if (
      dismissedVisit
      && (
        dismissedVisit.storyVersion > story.version
        || (
          dismissedVisit.storyVersion === story.version
          && dismissedVisit.latestArticleId === story.latestArticleId
        )
      )
    ) return false;
    return storyChangedSinceVisit(story, baseline.stories[story.id]);
  }, [baseline, dismissed]);

  const isStoryArticleNew = useCallback((storyId: string, addedVersion: number): boolean => {
    if (!baseline) return false;
    return storyArticleIsNew(addedVersion, baseline.stories[storyId]);
  }, [baseline]);

  const markStorySeen = useCallback((story: NewsStoryPreview) => {
    const nowMs = Date.now();
    const visit: StoryVisit = {
      storyVersion: story.version,
      latestArticleId: story.latestArticleId,
      seenAt: nowMs,
    };
    setDismissed((current) => ({ ...current, [story.id]: visit }));
    const next = recordStoryVisits(persistedRef.current, [story], nowMs);
    persistedRef.current = next;
    writeVisits(next);
  }, []);

  return {
    isStoryArticleNew,
    isStoryNew,
    markStorySeen,
    storyStateLoaded: loaded,
  };
}
