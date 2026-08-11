import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@fontsource-variable/cairo/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "117.ee",
  description: "ERR-i Eesti, majanduse ja spordi uudised selges ja kiires vaates.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf3f7" },
    { media: "(prefers-color-scheme: dark)", color: "#07131f" },
  ],
};

const themeScript = `
  try {
    const saved = localStorage.getItem('117-theme');
    const dark = saved === 'dark';
    document.documentElement.classList.toggle('dark', dark);
  } catch {}
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="et" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased selection:bg-[#4f8cff] selection:text-[#07131f] dark:bg-[#07131f] dark:text-[#e8f0f6]">
        {children}
      </body>
    </html>
  );
}
