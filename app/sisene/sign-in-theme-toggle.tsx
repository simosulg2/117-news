"use client";

import { usePageTheme } from "@/features/shell/client/use-page-theme";

export function SignInThemeToggle() {
  const { theme, toggleTheme } = usePageTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="min-h-8 border border-[#3b5870] px-2.5 text-xs font-bold text-[#c7d5df] outline-none hover:border-signal hover:text-[#7db0ff] focus-visible:ring-1 focus-visible:ring-signal"
      aria-label={theme === "dark" ? "Kasuta heledat kujundust" : "Kasuta tumedat kujundust"}
    >
      {theme === "dark" ? "Hele" : "Tume"}
    </button>
  );
}
