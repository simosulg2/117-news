# 117.ee uudisteportaal

Clean, responsive Estonian news portal built with Next.js App Router, React, Tailwind CSS and `rss-parser`.

## Features

- Server-only loading of all six ERR RSS feeds
- Five-minute feed caching and duplicate article merging
- Partial-feed failure handling
- Instant full-text search and category filters
- Responsive editorial card layout with RSS thumbnails
- Light/dark theme with saved preference
- Streaming skeleton state while the server loads feeds
- Direct, clearly labelled links to the original ERR articles

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production

```bash
npm run build
npm start
```

The application requires outbound HTTPS access to `www.err.ee`, `sport.err.ee`, and `news.err.ee`. Feed data is fetched in `lib/news.ts`; browser clients never contact RSS endpoints directly.

## Main structure

- `app/page.tsx` — streaming Server Component entry point
- `lib/news.ts` — server-only feed fetching, parsing, normalization and deduplication
- `components/news-portal.tsx` — instant search and category interface
- `components/news-card.tsx` — article presentation
- `components/feed-skeleton.tsx` — loading state
- `app/globals.css` — Tailwind import, design system and responsive styles
