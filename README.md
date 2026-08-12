# 117.ee

117.ee koondab ühte kiiresse töölauale Eesti uudised ja Võru ilma. Uudiste üldvaates kuvatakse kuni 117 kõige värskemat lugu ning igas teemavaates kuni 117 selle teema värskeimat saadaolevat lugu. Sama sündmust kajastavad eri allikad koondatakse ühe rea alla. Eraldi `/ilm` vaates saab uurida hetkeilma, mõõdetud ajalugu, mudelprognoosi, jooksu ajavahemikku ja sademeradarit. Vaikimisi avaneb hele teema, kuid kasutaja salvestatud valikut austatakse.

## Käivitamine

```bash
npm install
npm run dev
```

Ava `http://localhost:3000`.

Ilmavaade töötab ilma keskkonnamuutujateta. PostgreSQL on valikuline ja seda kasutatakse ainult värskete Võru mõõtmiste püsivaks kogumiseks.

## Kuidas andmed liiguvad

- Brauser küsib uudiseid rakenduse enda `/api/news` otspunktist.
- API laadib serveris ERR-i Eesti, majanduse ja spordi ning Postimehe ja Lõuna-Eesti Postimehe RSS-vood ja töötleb need `rss-parser` abil.
- Vastused puhverdatakse viieks minutiks; üksiku voo viga ei peata teisi vooge.
- Täpselt korduvad lingid eemaldatakse ning viimase 24 tunni sarnased eri allikate pealkirjad koondatakse ilma tehisintellekti või mudelite väljakutseteta.
- Eesti, majanduse ja spordi teemavaated koostatakse kogu saadaolevast uudiste hulgast eraldi, mitte ainult üldvaate 117 loo seast.
- Kategooriafiltrid, otsing, loetud uudiste kohalik ajalugu, kiirklahvid ja tumeda teema valik töötavad brauseris kohe.

Loetud artiklite ajalugu säilib selles brauseris 30 päeva ja seda saab uudislaua teaberibalt lähtestada. Kiirklahv `/` viib otsingusse ning `j` ja `k` liiguvad nähtavate uudiste vahel; fokuseeritud uudise avab tavapäraselt `Enter`.

## RSS-vood

- `https://www.err.ee/rss/eesti`
- `https://www.err.ee/rss/majandus`
- `https://sport.err.ee/rss`
- `https://www.postimees.ee/rss`
- `https://lounapostimees.postimees.ee/rss`

Artiklid avanevad alati algallika lehel. Postimehe tellijasisu kasutab seal brauseri olemasolevat sisselogimist; 117.ee ei töötle Postimehe kasutajaandmeid ega artiklite täistekste.

## Võru ilm

- `/api/weather` laadib Võru hetkevaatluse Keskkonnaagentuuri XML-ist, seitsme päeva tunniandmed Keskkonnaportaali andmeteenusest ning seitsme päeva mudelajaloo ja prognoosi Open-Meteost.
- Mõõdetud ja mudelandmeid ei esitata ühe allikana: graafikud, jooksu kokkuvõte ja allikate olek eristavad need selgelt.
- Ametlikus tunniarhiivis puudub Võru numbriline pilvisus. Varasema pilvisuse protsent on seetõttu mudelhinnang; hetkevaatluse kirjeldav pilvisus on mõõdetud vaatlus.
- `/api/weather/radar` koostab ametliku radariteenuse ajajoone. Brauser kuvab Keskkonnaagentuuri mõõdetud ja lühiprognoosi WMS-kihte 117.ee enda interaktiivsel kaardil.
- Ilma ja radari vead on teineteisest ning uudiste API-st isoleeritud. Iga töötav osa jääb teise allika vea korral kasutatavaks.
- Vaate, ajavahemiku, valitud näitajate ja jooksu aja eelistused säilivad ainult kasutaja brauseris.

Andmete juures kuvatakse Keskkonnaagentuuri, Ilmateenistuse, Open-Meteo ja OpenStreetMapi viited ning litsentsid.

### Valikuline mõõteajaloo kogumine

Kui `DATABASE_URL` puudub, kasutab ilmavaade ametlikku tunniarhiivi ja mudelajalugu ning töötab tavaliselt edasi. Värskete 10 minuti vaatluste talletamiseks lisa rakenduse runtime-keskkonda PostgreSQL ühendus:

```env
DATABASE_URL=postgresql://kasutaja:parool@host:5432/andmebaas
```

Rakendus loob esimesel ühendumisel ise tabeli `weather_observations`. Iga värske `/api/weather` päring talletab hetkevaatluse idempotentselt. Katkematu kogumise jaoks lisa Coolifys rakenduse Scheduled Task:

```text
Nimi: collect-voru-weather
Kava: */10 * * * *
Käsk: node -e "fetch('https://117.ee/api/weather?collect=' + Date.now(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }).then(r => { if (!r.ok) process.exit(1) })"
```

`collect` päringuparameeter annab igale kogumispäringule eraldi puhvõtme ning
vastus saadetakse `no-store` päisega. Nii jõuab ajastatud päring alati rakenduseni
ka siis, kui avaliku ilmavaate vastuseid puhverdab vaheserver.

`DATABASE_URL` on salajane runtime-väärtus: seda ei lisata GitHubi ega brauserikoodi.

## Kontrollid

```bash
npm test
npm run typecheck
npm run build
```
