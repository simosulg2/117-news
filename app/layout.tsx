import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "117.ee",
  description: "ERR-i Eesti, majanduse ja spordi uudised kiires terminalivaates.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f0ea" },
    { media: "(prefers-color-scheme: dark)", color: "#070a0d" },
  ],
};

const themeScript = `
  try {
    const saved = localStorage.getItem('117-theme');
    const dark = saved !== 'light';
    document.documentElement.classList.toggle('dark', dark);
  } catch {}
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="et" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased selection:bg-[#f4a62a] selection:text-black dark:bg-[#070a0d] dark:text-[#e8edf2]">
        {children}
      </body>
    </html>
  );
}
