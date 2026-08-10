# Sledenje

Samostojno gostovana (self-hosted) spletna aplikacija za sledenje vozilnega parka. Next.js
16 (App Router, Turbopack) + PostgreSQL/TimescaleDB (prek Prisma) + [Traccar](https://www.traccar.org/)
kot GPS/AVL strežnik za sprejem podatkov iz Teltonika naprav.

## Arhitektura

```
Teltonika naprava (GPS/AVL) --TCP:5027--> Traccar --REST/JDBC--> Postgres (baza "traccar")
                                             ^
                                             | REST API (service account)
                                             v
                    Uporabnik (brskalnik) <--HTTPS--> Next.js app --Prisma--> Postgres (baza "sledenje")
```

Štiri Docker storitve (glej `docker-compose.yml`):
- **postgres** — `timescale/timescaledb`, gosti DVE bazi: `sledenje` (podatki aplikacije prek
  Prisma) in `traccar` (Traccarjeva lastna baza, glej `docker-init/*.sql`).
- **traccar** — sprejema GPS podatke naprav (privzeto vrata `5027`), izpostavlja REST API na
  `8082` (samo lokalno, `127.0.0.1:8082`).
- **app** — ta Next.js aplikacija, govori s Traccarjevim REST API kot servisni uporabnik (glej
  spodaj), izpostavljena na `127.0.0.1:3002`.
- **autoheal** — samodejno znova zažene vsebnike, ki padejo na healthcheck.

Pred aplikacijo v produkciji teče [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
(konfiguracija zunaj tega repozitorija, v `/etc/cloudflared/config.yml` na gostitelju) — to ni
potrebno za lokalni razvoj.

## Predpogoji

- Docker + Docker Compose
- Node.js 24.x in npm (za lokalni razvoj zunaj vsebnika; sam `app` vsebnik si Node namesti sam)

## Nastavitev okoljskih spremenljivk

```bash
cp .env.example .env
cp .env.example .env.production
```

Nato izpolni VREDNOSTI v obeh datotekah — natančen pomen vsake spremenljivke je razložen v
komentarjih v `.env.example`. Na kratko:

- `.env` uporabljata **docker-compose** (za `POSTGRES_PASSWORD`) in **lokalni `npm run dev`**
  (za `DATABASE_URL`, ki kaže na lokalno dev bazo — glej spodaj).
- `.env.production` uporablja **`app` vsebnik v produkciji** (naložena prek `env_file` v
  `docker-compose.yml`) — `DATABASE_URL` je tu izpuščen, ker ga docker-compose sestavi sam iz
  `POSTGRES_PASSWORD`.
- Obe datoteki sta v `.gitignore` in se NIKOLI ne smeta commit-ati.

### Traccar servisni uporabnik (obvezen ročni korak)

Aplikacija se do Traccarjevega REST API prijavlja kot navaden Traccar uporabnik (ne obstaja
noben API ključ ali samodejna provizija). Po prvem zagonu `traccar` storitve:

1. Odpri Traccarjev spletni vmesnik (lokalno `http://localhost:8082`) in ustvari uporabnika
   (priporočeno z administratorskimi pravicami, da se izogneš morebitnim težavam z
   vidljivostjo naprav, ki jih kdo ustvari ročno mimo te aplikacije).
2. Vnesi ta email/geslo v `TRACCAR_SERVICE_EMAIL`/`TRACCAR_SERVICE_PASSWORD` v obeh `.env*`
   datotekah.

## Produkcijski zagon (Docker Compose)

```bash
docker compose build app
docker compose up -d
```

`docker-entrypoint.sh` ob zagonu `app` vsebnika samodejno pošene `prisma migrate deploy`
(migracije sheme) — ne pa tudi seed podatkov (glej spodaj).

### Prvi sudo uporabnik

```bash
docker compose exec app npm run db:seed
```

Ustvari uporabnika z emailom iz `SEED_ADMIN_EMAIL` in polnimi pravicami (`canManagePlatform`
itd.). Geslo se generira naključno in **izpiše samo v konzolo tega ukaza** — nikjer drugje ni
shranjeno, takoj si ga zapiši. Skript je idempotenten (varno ga je pognati večkrat — če
uporabnik že obstaja, ne naredi nič).

## Lokalni razvoj

Za `npm run dev` (Next.js dev strežnik zunaj Dockerja) potrebuješ ločeno, minimalno Postgres
bazo (namesto polnega docker-compose sklada):

```bash
docker run -d --name sledenje-dev-postgres -p 5433:5432 \
  -e POSTGRES_USER=sledenje -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=sledenje \
  timescale/timescaledb:latest-pg17
```

(geslo `devpass` tu ustreza privzeti vrednosti `DATABASE_URL` v `.env.example` — spremeni oboje
skupaj, če želiš drugo geslo). Nato:

```bash
npm install
npx prisma migrate deploy   # ali `npx prisma migrate dev` med razvojem sheme
npm run db:seed             # prvi sudo uporabnik, glej zgoraj
npm run dev
```

Za Traccar med lokalnim razvojem: poženi samo to storitev iz glavnega sklada
(`docker compose up -d postgres traccar`) ali se poveži na že tekočo produkcijsko instanco,
če obstaja.

## Znane posebnosti / pasti

- **maplibre-gl + Turbopack**: ta projekt uporablja Turbopack (privzeto v tej Next.js
  različici). `maplibre-gl` (uporabljen v `components/vehicle-map.tsx` za zemljevid) interno
  sestavi svoj Web Worker z združevanjem/stringifikacijo že naloženih modulov — Turbopack ta
  niz pri prepakiranju pokvari, kar POVSEM TIHO onemogoči nalaganje zemljevidnih ploščic
  (stil/sprite se naložijo normalno, ploščice pa nikoli) — ujema se z
  [maplibre-gl-js PR #7406](https://github.com/maplibre/maplibre-gl-js/pull/7406). Popravljeno
  je že v tem repozitoriju (`next.config.ts` alias na `maplibre-gl-csp.js` + `public/maplibre-gl-csp-worker.js`
  + `setWorkerUrl()` klic v `vehicle-map.tsx`) — pri nadgradnji `maplibre-gl` ali spremembi te
  konfiguracije preveri, da se zemljevid še vedno pravilno izriše PRI VISOKEM ZOOM-u (ne samo
  na privzetem prikazu celotne Slovenije), ker se pri tej napaki natanko to najprej pokvari.
- **`proxy.ts`** (ne `middleware.ts` — ta Next.js različica je datoteko preimenovala) preverja
  avtentikacijo za VSE poti razen tistih v `matcher` izjemah. Če dodajaš novo statično datoteko
  v `public/`, ki jo mora brskalnik naložiti brez prijave (kot `maplibre-gl-csp-worker.js`),
  jo moraš tam eksplicitno izvzeti.
- E-poštna obvestila (`lib/mail.ts`) so implementirana, a v tej postavitvi privzeto neaktivna
  (brez `SMTP_*` spremenljivk) — geslo ob ustvarjanju uporabnika se takrat le prikaže
  administratorju v vmesniku namesto po e-pošti.
- `AGENTS.md` v korenu opozarja, da se ta Next.js različica vede drugače od tega, kar je
  verjetno v učnih podatkih — pri negotovosti o API-ju preveri `node_modules/next/dist/docs/`.
