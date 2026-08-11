# 117.ee

Tume ja kiire uudisterminal, mis koondab ERR-i Eesti, majanduse ja spordi RSS-vood tihedasse tüpograafiapõhisesse vaatesse.

## Käivitamine

```bash
npm install
npm run dev
```

Ava `http://localhost:3000`.

## Kuidas andmed liiguvad

- Brauser küsib uudiseid rakenduse enda `/api/news` otspunktist.
- API laadib ERR-i Eesti, majanduse ja spordi RSS-vood serveris ning töötleb need `rss-parser` abil.
- Vastused puhverdatakse viieks minutiks; üksiku voo viga ei peata teisi vooge.
- Kategooriafiltrid, otsing ja tumeda teema valik töötavad brauseris kohe.

## Kontrollid

```bash
npm run typecheck
npm run build
```
