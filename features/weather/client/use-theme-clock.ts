"use client";

import { useClock } from "@/features/shell/client/use-clock";
import { usePageTheme } from "@/features/shell/client/use-page-theme";

export function useThemeClock() {
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock();
  return { theme, now, toggleTheme } as const;
}
