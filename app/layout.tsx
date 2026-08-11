import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "117.ee",
  description: "Eesti uudised usaldusväärsetest allikatest ühes selges ja kiires vaates.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0f12" },
  ],
};

const themeScript = `
  try {
    const saved = localStorage.getItem('117-theme');
    const dark = saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch {}
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="et" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased selection:bg-blue-200 selection:text-blue-950 dark:bg-[#0c0f12] dark:text-[#f2f4f7] dark:selection:bg-blue-800 dark:selection:text-white">
        {children}
      </body>
    </html>
  );
}
