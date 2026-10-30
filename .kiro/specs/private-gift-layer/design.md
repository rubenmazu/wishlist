# Design Document

## Overview

Acest document descrie designul tehnic pentru feature-ul "private-gift-layer": un strat privat de planificare a cadourilor peste wishlist-ul partajat, plus îmbunătățiri de organizare (reordonare, prioritate, sortare) și de experiență (copiere/deschidere link, buget total, PWA, confirmare la ștergere).

Designul respectă arhitectura existentă: Next.js 15 App Router, Server Actions pentru mutații, Turso/libSQL pentru date, auth cu cookie semnat HMAC. Soluțiile rămân deliberat simple — aplicația deservește doi utilizatori.

**Principiul central:** tot stratul privat se leagă de `viewer_id` (cine se uită), niciodată de owner-ul listei. Orice citire sau scriere pe stratul privat filtrează strict după utilizatorul autentificat curent. Partenerul nu vede niciodată marcajele "cumpărat", ordinea personală, ideile de cadou private sau notițele private ale celuilalt.

## Architecture

### Flux de date

```
┌─────────────────────────────────────────────────────────┐
│  Browser (PWA instalabilă)                                │
│  ┌───────────────────┐   ┌──────────────────────────┐    │
│  │ Server Components  │   │ Client Components ('use   │    │
│  │ (app/page.js)      │   │ client'): Reorder, Link   │    │
│  │ - citire + render  │   │ Actions, ConfirmDelete,   │    │
│  │ - buget total      │   │ SW register               │    │
│  └─────────┬─────────┘   └────────────┬─────────────┘    │
└────────────┼──────────────────────────┼──────────────────┘
             │ (render HTML)             │ (invocă Server Actions)
             ▼                           ▼
   ┌───────────────────────────────────────────────┐
   │  Server Actions (app/actions.js, 'use server') │
   │  - autorizare: getUserId()                     │
   │  - validare input din FormData                 │
   │  - izolare strat privat (viewer_id = user)     │
   └───────────────────────┬───────────────────────┘
                           │ db.execute({sql, args})
                           ▼
   ┌───────────────────────────────────────────────┐
   │  lib/queries.js  (helpers de compunere date)   │
   └───────────────────────┬───────────────────────┘
                           ▼
   ┌───────────────────────────────────────────────┐
   │  Turso / libSQL (lib/db.js)                    │
   │  profiles · items · viewer_item_state ·        │
   │  gift_ideas                                    │
   └───────────────────────────────────────────────┘
```

### Decizii de arhitectură

- **Server Components pentru citire, Server Actions pentru scriere** — păstrăm modelul existent. Nu adăugăm API routes.
- **Componente client doar unde e nevoie de interactivitate** — reordonare (drag), acțiuni pe link (clipboard), confirmare ștergere, înregistrare service worker. Toate mici și izolate.
- **Un modul nou `lib/queries.js`** care centralizează compunerea listelor (lista proprie vs lista partenerului cu strat privat). Așa logica de izolare stă într-un singur loc, ușor de verificat.

## Data Models

### Schema finală (SQLite / libSQL)

```sql
-- Profiluri (neschimbat)
create table if not exists profiles (
  id            text primary key,
  email         text not null unique,
  name          text not null,
  password_hash text not null
);

-- Produse ale owner-ului. Două coloane noi: priority, position.
create table if not exists items (
  id         text primary key,
  owner_id   text not null references profiles(id) on delete cascade,
  title      text not null check (length(title) between 1 and 120),
  url        text,
  price      real check (price is null or price >= 0),
  note       text check (note is null or length(note) <= 500),
  priority   integer not null default 0,   -- 0/1, "îmi doresc tare asta"
  position   real,                          -- ordinea proprie a owner-ului
  created_at text not null default (datetime('now'))
);
create index if not exists items_owner_created on items (owner_id, created_at desc);

-- Stratul privat al viewer-ului peste produsele ALTUI owner.
-- O singură linie per (viewer, produs). Toate câmpurile sunt private.
create table if not exists viewer_item_state (
  viewer_id    text not null references profiles(id) on delete cascade,
  item_id      text not null references items(id) on delete cascade,
  purchased    integer not null default 0,  -- 0/1, marcaj "cumpărat" privat
  position     real,                         -- ordinea personală a viewer-ului
  private_note text check (private_note is null or length(private_note) <= 500),
  primary key (viewer_id, item_id)
);

-- Idei de cadou private: intrări vizibile DOAR autorului, în contextul listei
-- unui anumit owner (target_owner_id). Nu apar niciodată în lista owner-ului.
create table if not exists gift_ideas (
  id              text primary key,
  author_id       text not null references profiles(id) on delete cascade,
  target_owner_id text not null references profiles(id) on delete cascade,
  title      text not null check (length(title) between 1 and 120),
  url        text,
  price      real check (price is null or price >= 0),
  note       text check (note is null or length(note) <= 500),
  position   real,
  created_at text not null default (datetime('now'))
);
create index if not exists gift_ideas_author_target
  on gift_ideas (author_id, target_owner_id);
```

### Justificarea modelului

- **`priority` și `position` pe `items`** — sunt proprietăți publice ale produsului owner-ului (R2 cere ca prioritatea să fie vizibilă partenerului; R1 cere ordine proprie). Stau direct pe item.
- **`viewer_item_state` tabel separat** — marcajul "cumpărat", ordinea personală a viewer-ului și nota privată sunt date per (viewer, produs). Un tabel cu cheie compusă `(viewer_id, item_id)` ține toate trei într-o singură linie, evită trei tabele paralele și simplifică JOIN-ul. Linia se creează lazy (la prima acțiune privată pe acel produs).
- **`gift_ideas` tabel separat, nu flag pe `items`** — ideile private au owner diferit de produsele reale și NU trebuie să scurgă niciodată în lista owner-ului. Ținându-le într-un tabel complet separat, interogarea listei owner-ului (`select ... from items where owner_id = ?`) rămâne curată prin construcție: nu există cale ca o idee privată să apară acolo. Un flag `is_private` pe `items` ar fi riscat (orice interogare care uită filtrul ar scurge date). Separarea e mai sigură.
- **`position` de tip `real`** — permite inserarea între două poziții (ex. media a două valori vecine) fără renumerotare globală. Simplu și suficient pentru liste mici.

### Migrare

Nu există date reale în producție încă, dar scriem migrarea defensiv în `scripts/seed.mjs`:

1. `create table if not exists` pentru toate cele patru tabele (idempotent).
2. Pentru `items`, adăugăm coloanele noi defensiv — SQLite nu suportă `ADD COLUMN IF NOT EXISTS`, deci citim `PRAGMA table_info(items)` și rulăm `ALTER TABLE items ADD COLUMN priority ...` / `position ...` doar dacă lipsesc.
3. Inițializăm `position` pentru produsele existente din `created_at` (cele mai noi primesc poziții mai mici), ca ordinea inițială să fie identică cu cea actuală.

Astfel, rularea repetată a seed-ului nu strică nimic.

## Stratul de acces la date (`lib/queries.js`)

Centralizează compunerea listelor și garantează izolarea. Funcții:

### `getOwnList(userId, sort)`
Lista proprie a utilizatorului.
```
select * from items where owner_id = :userId
```
Ordonare în funcție de `sort` (vezi secțiunea Sortare). Implicit după `position`.

### `getPartnerList(viewerId, ownerId, sort)`
Lista partenerului în perspectiva viewer-ului. Returnează o listă unificată de "intrări afișabile", fiecare cu un `kind` (`'item'` sau `'idea'`):

1. Produsele owner-ului, cu stratul privat atașat:
   ```
   select i.*, s.purchased, s.position as my_position, s.private_note
   from items i
   left join viewer_item_state s
     on s.item_id = i.id and s.viewer_id = :viewerId
   where i.owner_id = :ownerId
   ```
2. Ideile private ale viewer-ului pentru acel owner:
   ```
   select * from gift_ideas
   where author_id = :viewerId and target_owner_id = :ownerId
   ```
3. Se combină în memorie, se aplică sortarea, apoi **produsele cu `purchased = 1` se mută mereu la final** (R3.2, R8.5).

### `authorizePrivate(viewerId, ...)`
Toate scrierile pe stratul privat folosesc `viewer_id = viewerId` în clauza `where`/`insert`, deci un viewer nu poate atinge starea altuia (R7.3). Ideile se filtrează suplimentar pe `author_id = viewerId` la update/delete.

**Regulă de izolare (R7):** interogarea listei owner-ului nu atinge niciodată `viewer_item_state` sau `gift_ideas` ale altcuiva. Când owner-ul își vede lista (`getOwnList`), nu se face niciun JOIN cu stratul privat — deci nu poate vedea nimic din planificarea partenerului.

## Server Actions (`app/actions.js`)

Toate verifică sesiunea prin `getUserId()` (redirect la `/login` dacă lipsește) și validează input-ul din `FormData`.

| Acțiune | Primește | Face | Cerință |
|---|---|---|---|
| `addItem` | title, url, price, note | insert în `items` cu owner = user, position la coadă | existent |
| `updateItem` | id, câmpuri | update `items` where id & owner_id = user | existent |
| `deleteItem` | id | delete `items` where id & owner_id = user | R11 |
| `setPriority` | id, value | update `items set priority` where owner_id = user | R2 |
| `reorderOwn` | ids[] (ordine nouă) | update `position` pentru produsele proprii | R1 |
| `togglePurchased` | item_id | upsert `viewer_item_state(viewer=user)` purchased | R3 |
| `savePrivateNote` | item_id, text | upsert nota; text gol ⇒ șterge nota | R6 |
| `reorderPartner` | entries[] (ordine nouă) | upsert `viewer_item_state.position` + `gift_ideas.position` | R4 |
| `addGiftIdea` | target_owner_id, title, url, price, note | insert `gift_ideas` author = user | R5 |
| `updateGiftIdea` | id, câmpuri | update where id & author_id = user | R5 |
| `deleteGiftIdea` | id | delete where id & author_id = user | R5, R11 |

Sortarea (R8) nu e o acțiune, ci un query param `?sort=` citit în `page.js` (păstrează modelul `?view=partner` existent). `addGiftIdea`/`addItem` validează prin funcția `parse()` existentă (title obligatoriu, normalizare url, preț numeric) — R5.1, R5.6.

### Upsert `viewer_item_state`
```sql
insert into viewer_item_state (viewer_id, item_id, purchased, position, private_note)
values (?, ?, ?, ?, ?)
on conflict(viewer_id, item_id) do update set <coloana vizată> = excluded.<coloana>
```
Fiecare acțiune privată atinge doar coloana ei, lăsând restul neschimbate.

## Sortare (R8)

- Control minimal în UI: un `<select>` mic (sau link-uri) care setează `?sort=price|date|priority`. Fără a afișa permanent câmpuri auxiliare (R8.4).
- Reguli:
  - `price` — crescător după `price`, intrările fără preț la final (R8.1).
  - `date` — descrescător după `created_at` (R8.2).
  - `priority` — cu prioritate înaintea celor fără (R8.3).
  - Implicit (fără `sort`) — după `position` (ordinea personală/proprie salvată).
- **Sortarea e o vizualizare alternativă peste ordinea salvată.** Nu suprascrie `position`. Când utilizatorul revine la implicit, revine ordinea salvată.
- Pe lista partenerului, indiferent de sortare, produsele `purchased` rămân la final (R8.5).

## Components and Interfaces

### Server Components
- `app/page.js` — citește lista prin `lib/queries.js`, calculează bugetul total, randează. Primește `?view` și `?sort`.

### Client Components ('use client') — mici și izolate
- `app/ui/ReorderList.jsx` — listă reordonabilă. Detectează suportul pointer/drag; unde există, drag-and-drop (HTML5 draggable, fără librărie); unde nu, butoane sus/jos (R1.3). La final, trimite noua ordine către `reorderOwn`/`reorderPartner`. Optimist în UI; dacă acțiunea eșuează, revine la ordinea anterioară și arată eroare (R1.4).
- `app/ui/LinkActions.jsx` — butoane "Deschide" (țintă `_blank`, `rel="noopener noreferrer nofollow"`) și "Copiază link" (`navigator.clipboard.writeText` cu fallback `document.execCommand`), cu confirmare vizuală scurtă "Link copiat" și mesaj de eroare la nereușită (R9).
- `app/ui/ConfirmButton.jsx` — buton care cere confirmare (dialog nativ `confirm()` sau mic `<dialog>`), apoi declanșează `formAction` de ștergere (R11). Folosit atât pentru produse, cât și pentru idei.
- `app/ui/RegisterSW.jsx` — înregistrează service worker-ul la montare (R12.4). Randat o dată în `layout.js`.

### Interacțiunea server/client la reordonare
Server Component randează lista și o pasează ca prop componentei client `ReorderList`. Componenta ține starea locală a ordinii, iar la "drop"/click trimite array-ul de id-uri către Server Action printr-un `<form>` cu input ascuns sau prin `startTransition` + invocare directă a acțiunii. După succes, `revalidatePath('/')` reîmprospătează datele.

## Buget total (R10)

Calculat pe server în `page.js` din setul afișat: suma `price` ne-null. Formatat cu `Intl.NumberFormat('ro-RO', {style:'currency', currency:'RON'})` (reutilizăm `money` existent). Afișat discret în header-ul listei. Se recalculează la fiecare render (deci reflectă mereu setul curent).

## PWA (R12)

- **Manifest:** `app/manifest.js` (export convenție Next 15) cu `name`, `short_name`, `display: 'standalone'`, `start_url: '/'`, `background_color`, `theme_color`, și `icons` (192 și 512 px).
- **Iconuri:** de adăugat în `/public`: `icon-192.png`, `icon-512.png`, plus `apple-touch-icon.png` pentru iOS. (Placeholder generat; pot fi înlocuite ulterior.)
- **Service worker:** `public/sw.js` minimal — un SW valid care permite instalarea (install + activate; fetch pass-through, fără cache agresiv ca să nu servim date vechi ale listei). Înregistrat de `RegisterSW.jsx` la fiecare încărcare (R12.4).
- **`layout.js`:** adaugă `<meta name="theme-color">`, `<link rel="apple-touch-icon">` și `manifest` prin `metadata`. `viewport` cu `viewport-fit=cover` pentru fullscreen pe telefon (R12.3).

## Error Handling

- **Reordonare eșuată (R1.4):** UI optimist în `ReorderList`; dacă Server Action-ul aruncă, se revine la ordinea anterioară și se afișează un mesaj ro ("Nu am putut salva ordinea").
- **Copiere link eșuată (R9.4):** `LinkActions` prinde eroarea de la `clipboard`/fallback și afișează "Nu am putut copia linkul".
- **Validare input:** `parse()` respinge title gol (R5.6) — acțiunea se întoarce fără a scrie, starea rămâne neschimbată.
- **Autorizare:** orice acțiune fără sesiune ⇒ `redirect('/login')`. Orice scriere pe stratul privat al altui viewer e imposibilă prin clauza `where viewer_id = user` / `author_id = user` (R7.3).
- **SESSION_SECRET lipsă:** aruncă explicit la pornire (comportament existent în `lib/session.js`).

## Testing Strategy

Fără framework de test instalat momentan. Propunem un script de verificare `scripts/check.mjs` (rulat cu `node`) care validează regula critică de izolare (R7) direct pe o bază SQLite temporară:

1. Seed: doi useri A și B, fiecare cu produse.
2. A marchează "cumpărat", reordonează, adaugă idee privată și notiță privată pe lista lui B.
3. Assert: `getPartnerList(A, B)` include stratul privat al lui A.
4. Assert: `getOwnList(B)` NU conține nimic din stratul lui A (fără purchased, fără idei, fără note private, ordine neschimbată).
5. Assert: `getPartnerList(B, A)` nu vede stratul privat al lui A asupra listei lui B (stratul e per viewer).

Verificare manuală suplimentară: build (`npm run build`) și o trecere prin UI pentru PWA (instalare + fullscreen) și pentru acțiunile pe link.

## Correctness Properties

### Property 1: Izolare per viewer
Pentru orice utilizatori A ≠ B, datele returnate de `getOwnList(B)` nu depind de nicio linie din `viewer_item_state` sau `gift_ideas` unde actorul e A.
**Validates: Requirements 7.2, 7.4**

### Property 2: Ideile private nu scurg
Nicio idee din `gift_ideas` nu apare vreodată în lista proprie a `target_owner_id`.
**Validates: Requirements 5.3, 7.2**

### Property 3: Cumpărat la final
În `getPartnerList`, orice intrare cu `purchased = 1` apare după toate intrările cu `purchased = 0`, indiferent de sortare.
**Validates: Requirements 3.2, 8.5**

### Property 4: Scriere doar pe propriul strat
Orice `insert/update/delete` pe `viewer_item_state` folosește `viewer_id` = utilizatorul curent; pe `gift_ideas`, `author_id` = utilizatorul curent.
**Validates: Requirements 7.3**

### Property 5: Bugetul reflectă setul afișat
Suma e peste exact intrările randate, excluzând cele fără preț.
**Validates: Requirements 10.1, 10.2**

## Maparea cerințelor pe design

| Cerință | Element de design |
|---|---|
| R1 Reordonare proprie | `items.position`, `reorderOwn`, `ReorderList` |
| R2 Prioritate | `items.priority`, `setPriority`, marcaj vizual |
| R3 Marcaj cumpărat | `viewer_item_state.purchased`, `togglePurchased`, sortare la final + stil estompat |
| R4 Reordonare personală partener | `viewer_item_state.position`, `reorderPartner`, `getPartnerList` |
| R5 Idei de cadou private | tabel `gift_ideas`, `addGiftIdea/updateGiftIdea/deleteGiftIdea` |
| R6 Notițe private | `viewer_item_state.private_note`, `savePrivateNote` |
| R7 Izolare strat privat | `lib/queries.js` (fără JOIN privat în `getOwnList`), filtrare `viewer_id`/`author_id` |
| R8 Sortare | query param `?sort`, logică în `queries.js` |
| R9 Acțiuni link | `LinkActions.jsx` |
| R10 Buget total | calcul în `page.js`, format ro-RO |
| R11 Confirmare ștergere | `ConfirmButton.jsx` |
| R12 PWA | `app/manifest.js`, `public/sw.js`, `RegisterSW.jsx`, meta în `layout.js` |
