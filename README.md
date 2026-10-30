# Wishlist

Next.js 15 (App Router, Server Actions) + Turso/libSQL (SQLite). Wishlist partajat pentru două persoane (Marta și Ruben), cu acces de oriunde printr-un link.

## Rulare locală
1. `cp .env.example .env.local`
2. Pune un `SESSION_SECRET` lung și aleatoriu:
   `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`
3. Lasă `TURSO_DATABASE_URL=file:local.db` pentru o bază locală.
4. Setează parolele celor doi (`MARTA_PASSWORD`, `RUBEN_PASSWORD`) în `.env.local`.
5. `npm install`
6. `npm run seed` — creează tabelele și cei doi utilizatori.
7. `node scripts/icons.mjs` — generează iconurile PWA (o singură dată).
8. `npm run dev` → http://localhost:3000

Autentificare: email + parolă (cele setate la pasul 4). Nu există înregistrare — doar cele două conturi create de seed.

## Deploy (acces de oriunde printr-un link)

### 1. Bază de date în cloud — Turso (gratis)
1. Instalează Turso CLI și creează un cont: https://docs.turso.tech
2. `turso db create wishlist`
3. `turso db show wishlist --url` → copiază URL-ul `libsql://...`
4. `turso db tokens create wishlist` → copiază token-ul.
5. Rulează seed-ul pe baza din cloud (o singură dată), cu variabilele setate:
   - `TURSO_DATABASE_URL=libsql://...`
   - `TURSO_AUTH_TOKEN=...`
   - plus parolele, apoi `npm run seed`.

### 2. Aplicația — Vercel (gratis)
1. Urcă repo-ul pe GitHub și importă-l în Vercel.
2. În Vercel → Settings → Environment Variables, adaugă:
   - `TURSO_DATABASE_URL` (URL-ul `libsql://...`)
   - `TURSO_AUTH_TOKEN`
   - `SESSION_SECRET` (același gen de secret lung)
3. Deploy. Primești un link public, ex. `wishlist-xxx.vercel.app`.

## Funcții

Pe lista ta:
- Adaugi, editezi, ștergi produse (titlu, link, preț RON, notă).
- Reordonezi (drag pe desktop, săgeți sus/jos oriunde).
- Marchezi „prioritate" (★) — vizibilă și partenerului.

Pe lista partenerului — totul privat, doar tu vezi:
- Marchezi un produs ca „cumpărat": trece la final, estompat și tăiat.
- Reordonezi în ordinea ta (el o vede pe-a lui).
- Adaugi „idei de cadou" private, distincte vizual, pe care le editezi/ștergi.
- Notițe private pe produsele lui.

Peste tot:
- Sortare: ordinea mea / prioritate / preț / dată.
- Copiere link sau deschidere în tab nou.
- Buget total (suma prețurilor afișate).
- Confirmare la ștergere.
- PWA: instalabilă pe telefon, fullscreen.

## PWA (instalare pe telefon)
Iconurile placeholder se generează cu `node scripts/icons.mjs` (rulează o dată; le poți înlocui cu grafică finală oricând). După deploy, deschide linkul pe telefon și alege „Add to Home Screen". Aplicația se deschide fullscreen.

## Verificare
- `node scripts/check.mjs` — verifică regula de izolare (ce faci pe lista partenerului rămâne invizibil pentru el).
- `npm run build` — build de producție.

## Securitate
- Scrierea e verificată în Server Actions: produsele filtrează după `owner_id`; tot stratul privat (cumpărat, ordine personală, idei, notițe) filtrează strict după `viewer_id`/`author_id` = utilizatorul curent.
- Lista proprie a fiecăruia nu se interoghează niciodată împreună cu stratul privat al celuilalt — izolarea e prin construcție (vezi `lib/queries.js`).
- Sesiunea e un cookie `httpOnly` semnat HMAC cu `SESSION_SECRET`; nu poate fi falsificat fără secret.
- Parolele sunt stocate cu bcrypt, niciodată în clar.
- Middleware-ul redirecționează utilizatorii neautentificați către `/login`.
