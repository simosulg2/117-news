# 117.ee

117.ee koondab ühte kiiresse töölauale Eesti uudised, Võru ilma ja erakondade reitingud. Uudiste üldvaates kuvatakse kuni 117 kõige värskemat lugu ning igas teemavaates kuni 117 selle teema värskeimat saadaolevat lugu. Sama sündmust kajastavad eri allikad koondatakse ühe rea alla. Eraldi `/ilm` vaates saab uurida hetkeilma, mõõdetud ajalugu, mudelprognoosi, valitud ajavahemiku ilmaülevaadet ja sademeradarit. `/reitingud` kuvab Norstati viimase nelja nädala koondtulemuse, 101-kohalise Riigikogu projektsiooni ja viite Kantar Emori ametlikule kuureitingule. Vaikimisi avaneb hele teema, kuid kasutaja salvestatud valikut austatakse.

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

Kui `DATABASE_URL` puudub, töötab ilmavaade ametliku tunniarhiivi ja
mudelajalooga edasi. Värskete 10 minuti vaatluste PostgreSQL-i kogumise,
runtime-saladuste ja Coolify Scheduled Taski seadistus on dokumendis
[`docs/weather-collector.md`](docs/weather-collector.md).

## Erakondade reitingud

- `/api/ratings` laadib Ühiskonnauuringute Instituudi ja Norstati dokumenteeritud avalikust JSON-andmestikust viimase üleriigilise nelja nädala koondtulemuse, valimi ning eelmise võrreldava perioodi.
- Vastus puhverdatakse tunniks. Allika ajutise vea korral jääb viimati õnnestunud seis kasutatavaks ning kasutajale näidatakse, et värskendus hilineb.
- Riigikogu projektsioon jätab alla 5% toetusega erakonnad välja ja jaotab 101 kohta Eesti modifitseeritud D’Hondti jagajatega `1, 2^0,9, 3^0,9 …`. Täpselt 5% läheb arvesse.
- Projektsioon on üleriigiline küsitlusmudel, mitte ametlik valimistulemus ega ennustus. Tegelik jaotus sõltub 12 valimisringkonnast ning isiku-, ringkonna- ja kompensatsioonimandaatidest.
- Koalitsioonilabor lubab valida projektsioonis kohti saanud erakondi ja kontrollida 51 koha enamust. Valitsuse võrdlus kasutab praegust Reformierakonna ja Eesti 200 valitsusliitu.
- Kantar Emori kuureitingule viidatakse Emori ametliku lehe kaudu. Selle väärtusi ei kraabita kohtade kalkulaatorisse ega keskmistata Norstatiga, sest Emor ei paku reitingutele dokumenteeritud avalikku andme-API-t ning uuringute metoodika ja avaldamisrütm erinevad.

Reitingute juures kuvatakse küsitlusperiood, valim, eelistuseta vastajate osakaal, muutus eelmise võrreldava koondi suhtes, andmete laadimise aeg ning allika- ja metoodikaviited.

## Kontrollid

```bash
npm test
npm run check:context
npm run typecheck
npm run build
```
