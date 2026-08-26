# Uudislugude ajaloo koguja

Uudisvaade töötab ilma andmebaasita, kasutades jooksva RSS-päringu ajutist
hetkepilti. Allolev valikuline seadistus seob uudiste metaandmed PostgreSQL-is
püsivate lugude ja kajastussündmustega.

## Runtime-saladused

Lisa rakenduse runtime-keskkonda:

```env
DATABASE_URL=postgresql://kasutaja:parool@host:5432/andmebaas
NEWS_COLLECTOR_TOKEN=vähemalt-32-baidine-juhuslik-saladus
```

64-märgilise juhusliku võtme saab luua näiteks käsuga:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Käsu väljund läheb ainult Coolify runtime-saladuseks, mitte faili ega GitHubi.
Mõlemad väärtused peavad Coolifys olema ainult runtime-keskkonnas, `Literal` ja
salajased; build-keskkonda neid ei lisata. Kui kasutusel on ka ilmakoguja, peab
`NEWS_COLLECTOR_TOKEN` erinema `WEATHER_COLLECTOR_TOKEN`-ist.

Koguja loob esimesel edukal kirjutamisel ise uudisloo, kajastussündmuse, artikli
ja revisjoni tabelid. Avalik `GET /api/news` ainult loeb andmeid. Talletamine toimub
eraldi autentitud `POST /api/news` kaudu ning loo ajajoon laaditakse vajadusel
otspunktist `GET /api/news/stories/[id]`.

## Coolify Scheduled Task

Katkematu kogumise jaoks lisa rakenduse Scheduled Task:

```text
Nimi: collect-news-stories
Kava: */5 * * * *
Käsk: node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/news',{method:'POST',headers:{Authorization:'Bearer '+process.env.NEWS_COLLECTOR_TOKEN},signal:AbortSignal.timeout(45000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
```

Scheduled Task loeb võtme konteineri runtime-keskkonnast ja pöördub rakenduse
poole sama konteineri loopback-aadressil. Võti saadetakse ainult
`Authorization` päises; saladus ei jõua URL-i, käsu teksti ega avaliku
pöördproksi kaudu võrku. Päringul on 45-sekundiline ülempiir.

Koguja vastused on `no-store`. Puuduv või vale võti, kõigi RSS-voogude
ebaõnnestumine või PostgreSQL-i kirjutusviga tagastab veakoodi, et Coolify ei
märgiks katkist kogumist õnnestunuks. Üksiku voo viga ei peata ülejäänud voogude
kogumist ning osaline allikaolek jääb vastuses nähtavaks.

## Säilitamine ja varurežiim

Sobitamisel arvestatakse sama kategooria lugusid viimase 72 tunni seest.
Uudisloo ajalugu säilitatakse 30 päeva ning aegunud read eemaldatakse koguja
töö käigus. Süsteem talletab RSS-i pealkirja, lühikirjelduse, lingi, allika ja
avaldamisaja, mitte artikli täisteksti.

Kui `DATABASE_URL` puudub või andmebaas pole ajutiselt loetav, kasutab avalik
uudisvaade jooksva päringu hetkepilti ja senist piiratud eri allikate koondamist.
Kui andmebaas töötab, kuid kõik RSS-vood ajutiselt ebaõnnestuvad, võib avalik
vaade kasutada viimase 72 tunni talletatud lugusid ning märgib selle vastuses
varurežiimiks. Andmebaasi- ega autentimisandmeid ei lisata avalikku veateatesse.

Ajajoon on automaatse tekstisarnasuse tulemus. See ei tõenda põhjuslikku seost
ega sündmuste tegelikku järjepidevust. 117.ee ei kraabi artiklite täistekste ega
genereeri tehisintellektiga kokkuvõtteid, põhjuslikke väiteid või hinnanguid.

`DATABASE_URL` ja `NEWS_COLLECTOR_TOKEN` on salajased runtime-väärtused: neid ei
lisata GitHubi, brauserikoodi, URL-i ega logidesse.
