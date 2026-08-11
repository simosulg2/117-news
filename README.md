# 117.ee

Kiire uudislaud, mis koondab ERR-i ja Postimehe Eesti, majanduse ning spordi RSS-vood. Kuni 117 kõige värskemat uudislugu kuvatakse kompaktses Cairo kirjatüübiga vaates; sama sündmust kajastavad eri allikad koondatakse ühe rea alla. Vaikimisi avaneb hele teema, kuid kasutaja salvestatud valikut austatakse.

## Käivitamine

```bash
npm install
npm run dev
```

Ava `http://localhost:3000`.

## Kuidas andmed liiguvad

- Brauser küsib uudiseid rakenduse enda `/api/news` otspunktist.
- API laadib serveris ERR-i Eesti, majanduse ja spordi ning Postimehe ja Lõuna-Eesti Postimehe RSS-vood ja töötleb need `rss-parser` abil.
- Vastused puhverdatakse viieks minutiks; üksiku voo viga ei peata teisi vooge.
- Täpselt korduvad lingid eemaldatakse ning viimase 24 tunni sarnased eri allikate pealkirjad koondatakse ilma tehisintellekti või mudelite väljakutseteta.
- Kategooriafiltrid, otsing, loetud uudiste kohalik ajalugu, kiirklahvid ja tumeda teema valik töötavad brauseris kohe.

Loetud artiklite ajalugu säilib selles brauseris 30 päeva ja seda saab uudislaua teaberibalt lähtestada. Kiirklahv `/` viib otsingusse ning `j` ja `k` liiguvad nähtavate uudiste vahel; fokuseeritud uudise avab tavapäraselt `Enter`.

## RSS-vood

- `https://www.err.ee/rss/eesti`
- `https://www.err.ee/rss/majandus`
- `https://sport.err.ee/rss`
- `https://www.postimees.ee/rss`
- `https://lounapostimees.postimees.ee/rss`

Artiklid avanevad alati algallika lehel. Postimehe tellijasisu kasutab seal brauseri olemasolevat sisselogimist; 117.ee ei töötle Postimehe kasutajaandmeid ega artiklite täistekste.

## Kontrollid

```bash
npm test
npm run typecheck
npm run build
```
