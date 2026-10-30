# Implementation Plan

## Overview

Planul de implementare pentru "private-gift-layer", organizat de la bază spre interfață: întâi schema și stratul de date (unde trăiește izolarea), apoi Server Actions, apoi componentele client și pagina, apoi PWA și stilurile, și în final verificarea. Fiecare task face referire la cerințele pe care le acoperă.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "5", "7"] },
    { "wave": 3, "tasks": ["3", "4"] },
    { "wave": 4, "tasks": ["6"] },
    { "wave": 5, "tasks": ["8"] },
    { "wave": 6, "tasks": ["9"] }
  ]
}
```

- Task 1 e fundația; tot restul depinde de el.
- Task 2 (inclusiv `check.mjs`) validează izolarea înainte de a construi UI.
- Task 5 (componente client) poate fi făcut în paralel cu 3/4; se integrează la 6.
- Task 7 (PWA) e independent și poate rula oricând după 1.
- Task 9 închide totul cu verificarea și build-ul.

## Tasks

- [x] 1. Schema și migrare bază de date
  - Actualizează `db/schema.sql` cu coloanele noi pe `items` (`priority`, `position`) și cele două tabele noi (`viewer_item_state`, `gift_ideas`), conform DDL din design.
  - Modifică `scripts/seed.mjs` să creeze toate cele patru tabele cu `create table if not exists` și indexurile.
  - Adaugă migrare defensivă în seed: citește `PRAGMA table_info(items)` și rulează `ALTER TABLE items ADD COLUMN` pentru `priority`/`position` doar dacă lipsesc; inițializează `position` din `created_at` pentru produsele existente.
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 2. Strat de acces la date și izolare (`lib/queries.js`)
- [x] 2.1 Creează `lib/queries.js` cu `getOwnList(userId, sort)` și `getPartnerList(viewerId, ownerId, sort)`
  - `getOwnList`: `select * from items where owner_id = ?` cu sortare; fără niciun JOIN pe stratul privat.
  - `getPartnerList`: produsele owner-ului LEFT JOIN `viewer_item_state` (pe viewer) + ideile din `gift_ideas` (author=viewer, target=owner), combinate, cu `purchased` mereu la final.
  - Normalizează fiecare intrare cu un câmp `kind` (`'item'` / `'idea'`).
  - _Requirements: 3.2, 4.2, 5.2, 6.2, 7.2, 7.4, 8.5_
- [x] 2.2 Adaugă logica de sortare în `queries.js`
  - Suportă `sort` = `price` (crescător, fără-preț la final), `date` (created_at desc), `priority` (prioritate înainte), implicit `position`.
  - Pe lista partenerului, re-aplică regula „purchased la final" peste orice sortare.
  - _Requirements: 8.1, 8.2, 8.3, 8.5_
- [x] 2.3 Scrie `scripts/check.mjs` pentru verificarea izolării (Property 1-4)
  - Bază SQLite temporară, doi useri, seed produse; A acționează pe lista lui B (purchased, reorder, idee, notă).
  - Assert: `getPartnerList(A,B)` include stratul lui A; `getOwnList(B)` nu conține nimic din stratul lui A; `getPartnerList(B,A)` nu vede stratul lui A.
  - _Requirements: 5.3, 7.2, 7.3, 7.4_

- [x] 3. Server Actions pentru lista proprie
- [x] 3.1 Adaugă `setPriority` în `app/actions.js`
  - Primește `id`, `value`; `update items set priority = ? where id = ? and owner_id = ?`.
  - _Requirements: 2.1, 2.2_
- [x] 3.2 Adaugă `reorderOwn` în `app/actions.js`
  - Primește ordinea nouă de `id`-uri; recalculează `position` pentru produsele proprii într-o tranzacție/batch.
  - _Requirements: 1.1, 1.2_
- [x] 3.3 Setează `position` la adăugare în `addItem`
  - Produsul nou primește o poziție la coada listei proprii.
  - _Requirements: 1.2, 4.4_

- [x] 4. Server Actions pentru stratul privat (lista partenerului)
- [x] 4.1 Adaugă `togglePurchased` cu upsert în `viewer_item_state`
  - Upsert pe `(viewer_id, item_id)`, comută `purchased`; `viewer_id` = user curent.
  - _Requirements: 3.1, 3.4, 7.3_
- [x] 4.2 Adaugă `savePrivateNote` cu upsert
  - Upsert `private_note`; text gol ⇒ setează null (elimină nota).
  - _Requirements: 6.1, 6.3, 6.4, 7.3_
- [x] 4.3 Adaugă `reorderPartner`
  - Primește ordinea nouă (produse + idei); scrie `viewer_item_state.position` (upsert) și `gift_ideas.position`, filtrat pe viewer.
  - _Requirements: 4.1, 4.2, 7.3_
- [x] 4.4 Adaugă `addGiftIdea`, `updateGiftIdea`, `deleteGiftIdea`
  - Insert/update/delete în `gift_ideas` cu `author_id` = user; reutilizează `parse()`; title gol respins.
  - _Requirements: 5.1, 5.4, 5.5, 5.6, 7.3_

- [x] 5. Componente client UI
- [x] 5.1 Creează `app/ui/ReorderList.jsx`
  - Listă reordonabilă: drag-and-drop HTML5 unde e suportat, butoane sus/jos altfel; trimite ordinea nouă la `reorderOwn`/`reorderPartner`; optimist cu revenire la eroare.
  - _Requirements: 1.2, 1.3, 1.4, 4.1_
- [x] 5.2 Creează `app/ui/LinkActions.jsx`
  - Butoane „Deschide" (tab nou, rel sigur) și „Copiază link" (clipboard + fallback), cu confirmare „Link copiat" și mesaj de eroare.
  - _Requirements: 9.1, 9.2, 9.3, 9.4_
- [x] 5.3 Creează `app/ui/ConfirmButton.jsx`
  - Buton cu confirmare înainte de a declanșa `formAction` de ștergere; folosit la produse și idei.
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 6. Pagina principală (`app/page.js`)
- [x] 6.1 Rescrie citirea prin `lib/queries.js` și citește `?sort`
  - Folosește `getOwnList`/`getPartnerList`; păstrează logica `?view`; pasează datele la componentele client.
  - _Requirements: 1.1, 3.2, 4.2, 5.2, 8.4_
- [x] 6.2 Randează stratul privat pe lista partenerului
  - Marcaj cumpărat (estompat/tăiat + semn), idei distincte vizual, notiță privată distinctă, controale togglePurchased/note/idei.
  - _Requirements: 3.3, 5.2, 6.2_
- [x] 6.3 Randează prioritatea și controlul de sortare
  - Marcaj de prioritate pe produse (vizibil și partenerului); `<select>`/link-uri minimale pentru `?sort`.
  - _Requirements: 2.3, 2.4, 8.4_
- [x] 6.4 Calculează și afișează bugetul total
  - Suma `price` din setul afișat, format ro-RO, afișat discret în header.
  - _Requirements: 10.1, 10.2, 10.3, 10.4_
- [x] 6.5 Integrează confirmarea la ștergere
  - Înlocuiește butoanele de ștergere cu `ConfirmButton` pentru produse și idei.
  - _Requirements: 11.1_

- [x] 7. PWA
- [x] 7.1 Creează `app/manifest.js` și iconurile din `/public`
  - Manifest standalone (name, short_name, icons 192/512, theme/background color); adaugă `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.
  - _Requirements: 12.1, 12.2_
- [x] 7.2 Creează `public/sw.js` și `app/ui/RegisterSW.jsx`
  - Service worker minimal (install/activate, fetch pass-through); componentă client care îl înregistrează la montare.
  - _Requirements: 12.4_
- [x] 7.3 Actualizează `app/layout.js` pentru fullscreen
  - `metadata` cu manifest + apple-touch-icon, `theme-color`, `viewport` cu `viewport-fit=cover`; montează `RegisterSW`.
  - _Requirements: 12.1, 12.3_

- [x] 8. Stiluri (`app/globals.css`)
  - Stiluri minimaliste pentru: marcaj prioritate, produs cumpărat (estompat/tăiat + semn), idee de cadou (distinctă), notiță privată, control de sortare, buton de buget, mânere de reordonare, acțiuni link.
  - _Requirements: 2.3, 3.3, 5.2, 6.2, 8.4_

- [x] 9. Verificare finală
  - Rulează `node scripts/check.mjs` (izolare), `npm run build`, și corectează eventualele erori.
  - Actualizează `README.md` cu noile funcții și pașii PWA.
  - _Requirements: 7.2, 7.3, 7.4, 12.1_

## Notes

- Node.js nu e instalat pe mașina curentă; `npm install`, `seed`, `check` și `build` vor trebui rulate după instalarea Node. Acolo unde verificarea automată nu e posibilă local, se va semnala explicit.
- Iconurile PWA din `/public` sunt placeholder-e; pot fi înlocuite ulterior cu grafică finală fără schimbări de cod.
- `position` e de tip `real` pentru a permite inserții între poziții fără renumerotare globală — potrivit pentru liste mici.
- Sortarea (`?sort`) e o vizualizare alternativă; nu suprascrie ordinea salvată în `position`.
