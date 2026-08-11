# 117.ee

Minimalistlik Next.js uudisteportaal, mis koondab kuus ERR-i RSS-voogu ühte kiiresse vaatesse.

## Käivitamine

```bash
npm install
npm run dev
```

Ava `http://localhost:3000`.

## Kuidas andmed liiguvad

- Brauser küsib uudiseid rakenduse enda `/api/news` otspunktist.
- API laadib kuus ERR-i RSS-voogu serveris ja töötleb need `rss-parser` abil.
- Vastused puhverdatakse viieks minutiks; üksiku voo viga ei peata teisi vooge.
- Kategooriafiltrid, otsing ja tumeda teema valik töötavad brauseris kohe.

## Kontrollid

```bash
npm run typecheck
npm run build
```
