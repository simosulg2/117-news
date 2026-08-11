import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111315",
        paper: "#f4f3ee",
        signal: "#315efb",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
        display: ["var(--font-display)", "Arial", "sans-serif"],
      },
      boxShadow: {
        float: "0 24px 70px -30px rgba(20, 27, 45, 0.32)",
      },
    },
  },
  plugins: [],
};

export default config;
