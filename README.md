# Wishlist

Next.js 15 (App Router, Server Actions) + Supabase (Auth, Postgres, RLS).

## Pornire
1. Creează un proiect pe supabase.com și rulează `supabase/schema.sql` în SQL Editor.
2. Authentication → Users → Add user: creează cele două conturi (email + parolă). Opțional, la "User metadata": `{"name":"Ruben"}`; altfel numele = partea dinaintea @.
3. Authentication → Sign In / Providers → dezactivează "Allow new users to sign up".
4. `cp .env.example .env.local` și completează URL + anon key (Project Settings → API).
5. `npm install && npm run dev` → http://localhost:3000
6. Deploy: Vercel, cu aceleași două variabile de mediu.

## Securitate
- Scrierea e blocată la nivel de bază de date (RLS): doar proprietarul poate insera/edita/șterge. UI-ul ascunde butoanele, dar baza de date impune regula.
- Server Actions verifică sesiunea și filtrează după `owner_id`; middleware-ul redirecționează utilizatorii neautentificați.
- Doar cheia `anon` ajunge în aplicație; nu folosi niciodată `service_role` în client.
