import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "117.ee — Uudised ilma mürata",
  description: "Värskeimad Eesti ja maailma uudised ERR-i kanalitest ühes selges vaates.",
};

const themeScript = `
  try {
    const saved = localStorage.getItem('117-theme');
    const dark = saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (_) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="et" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
