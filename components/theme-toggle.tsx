"use client";

import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("117-theme", next ? "dark" : "light");
  }

  return (
    <button className="icon-button" onClick={toggleTheme} aria-label="Vaheta värviteemat">
      <Sun className="theme-sun" size={18} strokeWidth={1.8} />
      <Moon className="theme-moon" size={18} strokeWidth={1.8} />
    </button>
  );
}
