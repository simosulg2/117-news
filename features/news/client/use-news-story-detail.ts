"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { NewsStoryDetailResponse, NewsStoryPreview } from "@/lib/types";

type StoryDetailState = {
  data: NewsStoryDetailResponse | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
};

function detailError(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const value = (body as { error?: unknown }).error;
    if (typeof value === "string" && value.trim()) return value.slice(0, 240);
  }
  return "Kajastuse ajaloo laadimine ebaõnnestus.";
}

export function useNewsStoryDetail(
  story: NewsStoryPreview | null,
  enabled: boolean,
): StoryDetailState {
  const [data, setData] = useState<NewsStoryDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const dataRef = useRef<NewsStoryDetailResponse | null>(null);

  useEffect(() => {
    if (!story) {
      dataRef.current = null;
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!enabled) return;
    if (
      dataRef.current?.story.id === story.id
      && dataRef.current.story.version >= story.version
    ) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetch(`/api/news/stories/${encodeURIComponent(story.id)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as unknown;
      if (!response.ok) throw new Error(detailError(body));
      const next = body as NewsStoryDetailResponse;
      dataRef.current = next;
      setData(next);
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : detailError(null));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [enabled, retryToken, story]);

  const visibleData = data?.story.id === story?.id ? data : null;
  return {
    data: visibleData,
    error,
    loading: enabled && loading,
    retry: useCallback(() => setRetryToken((current) => current + 1), []),
  };
}
