"use client";

import { useCallback, useEffect, useState } from "react";

export type PageTheme = "light" | "dark";

export function usePageTheme() {
  const [theme, setTheme] = useState<PageTheme>("light");

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("117-theme", next);
      } catch {
        // Theme switching remains available when storage is unavailable.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme } as const;
}
