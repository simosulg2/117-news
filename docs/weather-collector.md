# Võru mõõteajaloo koguja

Ilmavaade töötab ilma andmebaasita, kasutades ametlikku tunniarhiivi ja
mudelajalugu. Allolev valikuline seadistus talletab PostgreSQL-i värsked Võru
jaama 10 minuti vaatlused.

## Runtime-saladused

Lisa rakenduse runtime-keskkonda:

```env
DATABASE_URL=postgresql://kasutaja:parool@host:5432/andmebaas
WEATHER_COLLECTOR_TOKEN=vähemalt-32-baidine-juhuslik-saladus
```

64-märgilise juhusliku võtme saab luua näiteks käsuga:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Käsu väljund läheb ainult Coolify runtime-saladuseks, mitte faili ega GitHubi.
Mõlemad väärtused peavad Coolifys olema ainult runtime-keskkonnas, `Literal` ja
salajased; build-keskkonda neid ei lisata.

Rakendus loob esimesel ühendumisel ise tabeli `weather_observations`. Avalik
`GET /api/weather` ainult loeb andmeid ning talletamine toimub autentitud
`POST /api/weather` kaudu.

## Coolify Scheduled Task

Katkematu kogumise jaoks lisa rakenduse Scheduled Task:

```text
Nimi: collect-voru-weather
Kava: */10 * * * *
Käsk: node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/weather',{method:'POST',headers:{Authorization:'Bearer '+process.env.WEATHER_COLLECTOR_TOKEN},signal:AbortSignal.timeout(45000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
```

Scheduled Task loeb võtme konteineri runtime-keskkonnast ja pöördub rakenduse
poole sama konteineri loopback-aadressil. Võti saadetakse ainult
`Authorization` päises; saladus ei jõua URL-i, käsu teksti ega avaliku
pöördproksi kaudu võrku. Päringul on 45-sekundiline ülempiir.

Koguja vastused on `no-store`. Puuduv mõõtmine või ebaõnnestunud PostgreSQL
kirjutus tagastab veakoodi, et Coolify ei märgiks katkist kogumist õnnestunuks.

`DATABASE_URL` ja `WEATHER_COLLECTOR_TOKEN` on salajased runtime-väärtused: neid
ei lisata GitHubi, brauserikoodi, URL-i ega logidesse.
