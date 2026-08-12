# 117.ee

117.ee koondab ühte kiiresse töölauale Eesti uudised ja Võru ilma. Uudiste üldvaates kuvatakse kuni 117 kõige värskemat lugu ning igas teemavaates kuni 117 selle teema värskeimat saadaolevat lugu. Sama sündmust kajastavad eri allikad koondatakse ühe rea alla. Eraldi `/ilm` vaates saab uurida hetkeilma, mõõdetud ajalugu, mudelprognoosi, valitud ajavahemiku ilmaülevaadet ja sademeradarit. Vaikimisi avaneb hele teema, kuid kasutaja salvestatud valikut austatakse.

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
- Ajaloo vaates saab valida 24 tundi, 3, 7, 30 või 90 päeva ning kuni 90-päevase kohandatud ajavahemiku. Pikemad vaated laaditakse eraldi `/api/weather/history` otspunktist, et tavavaade püsiks kiire.
- Kuni seitsme päeva vaates säilivad talletatud mõõtmiste üksikasjad; pikemad graafikud koondatakse tunnipunktideks. Vanem ametlik arhiiv on tunnise sammuga ning 10 minuti täpsus koguneb PostgreSQL-i alles koguja käivitamisest.
- Valitud ajaloo ajavahemiku algandmed saab ilma graafiku koondamiseta CSV-failina alla laadida.
- Mõõdetud ja mudelandmeid ei esitata ühe allikana: graafikud, ajavahemiku kokkuvõte ja allikate olek eristavad need selgelt.
- Graafikul hõljutamine või puudutamine kuvab täpse Eesti aja ja väärtuse kõigil graafikutel sama ajapunkti juures; valikut saab juhtida ka nooleklahvidega.
- Ametlikus tunniarhiivis puudub Võru numbriline pilvisus. Varasema pilvisuse protsent on seetõttu mudelhinnang; hetkevaatluse kirjeldav pilvisus on mõõdetud vaatlus.
- `/api/weather/radar` koostab ametliku radariteenuse ajajoone. Brauser kuvab Keskkonnaagentuuri mõõdetud ja lühiprognoosi WMS-kihte 117.ee enda interaktiivsel kaardil.
- Ilma ja radari vead on teineteisest ning uudiste API-st isoleeritud. Iga töötav osa jääb teise allika vea korral kasutatavaks.
- Kui kõik välised ilmaallikad ajutiselt ebaõnnestuvad, jääb PostgreSQL-i salvestatud mõõteajalugu kasutatavaks; seda ei esitata ekslikult värske hetkevaatlusena.
- Vaate, ajavahemiku, valitud näitajate ja kokkuvõtte aja eelistused säilivad ainult kasutaja brauseris.

Andmete juures kuvatakse Keskkonnaagentuuri, Ilmateenistuse, Open-Meteo ja OpenStreetMapi viited ning litsentsid.

### Valikuline mõõteajaloo kogumine

Kui `DATABASE_URL` puudub, kasutab ilmavaade ametlikku tunniarhiivi ja mudelajalugu ning töötab tavaliselt edasi. Värskete 10 minuti vaatluste talletamiseks lisa rakenduse runtime-keskkonda PostgreSQL ühendus:

```env
DATABASE_URL=postgresql://kasutaja:parool@host:5432/andmebaas
WEATHER_COLLECTOR_TOKEN=vähemalt-32-baidine-juhuslik-saladus
```

64-märgilise juhusliku võtme saab luua näiteks käsuga
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Käsu väljund läheb ainult Coolify runtime-saladuseks, mitte faili ega GitHubi.

Mõlemad väärtused peavad Coolifys olema ainult runtime-keskkonnas, `Literal` ja salajased; build-keskkonda neid ei lisata. Rakendus loob esimesel ühendumisel ise tabeli `weather_observations`. Avalik `GET /api/weather` ainult loeb andmeid ning talletamine toimub autentitud `POST /api/weather` kaudu. Katkematu kogumise jaoks lisa Coolifys rakenduse Scheduled Task:

```text
Nimi: collect-voru-weather
Kava: */10 * * * *
Käsk: node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/weather',{method:'POST',headers:{Authorization:'Bearer '+process.env.WEATHER_COLLECTOR_TOKEN},signal:AbortSignal.timeout(45000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
```

Scheduled Task loeb võtme konteineri runtime-keskkonnast ja pöördub rakenduse poole
sama konteineri loopback-aadressil. Võti saadetakse ainult `Authorization` päises;
saladus ei jõua URL-i, käsu teksti ega avaliku pöördproksi kaudu võrku. Päringul on
45-sekundiline ülempiir. Koguja vastused on `no-store` ning puuduv mõõtmine või
ebaõnnestunud PostgreSQL kirjutus tagastab veakoodi, et Coolify ei märgiks katkist
kogumist õnnestunuks.

`DATABASE_URL` ja `WEATHER_COLLECTOR_TOKEN` on salajased runtime-väärtused: neid ei
lisata GitHubi, brauserikoodi, URL-i ega logidesse.

## Kontrollid

```bash
npm test
npm run typecheck
npm run build
```
