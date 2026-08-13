"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

import { nextNewsItemIndex } from "@/features/news/model/news-items";

export function useNewsKeyboardNavigation(
  visibleItemIds: readonly string[],
  searchRef: RefObject<HTMLInputElement | null>,
) {
  const headlineRefs = useRef(new Map<string, HTMLAnchorElement>());

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false'])")) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.shiftKey || (event.key !== "j" && event.key !== "k") || visibleItemIds.length === 0) return;

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const activeId =
        activeElement?.dataset.newsPrimaryId
        ?? activeElement?.closest<HTMLElement>("[data-news-row-id]")?.dataset.newsRowId;
      const currentIndex = activeId ? visibleItemIds.indexOf(activeId) : -1;
      const nextIndex = nextNewsItemIndex(event.key === "j" ? "next" : "previous", currentIndex, visibleItemIds.length);
      const nextHeadline = headlineRefs.current.get(visibleItemIds[nextIndex]);
      if (!nextHeadline) return;

      event.preventDefault();
      nextHeadline.focus({ preventScroll: true });
      nextHeadline.scrollIntoView({ block: "nearest" });
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [searchRef, visibleItemIds]);

  return useCallback((id: string, node: HTMLAnchorElement | null) => {
    if (node) {
      headlineRefs.current.set(id, node);
    } else {
      headlineRefs.current.delete(id);
    }
  }, []);
}
