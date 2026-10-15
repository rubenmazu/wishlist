-- Rulează în Supabase > SQL Editor
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  url text check (url is null or url ~* '^https?://'),
  price numeric(10,2) check (price >= 0),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index on public.items (owner_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.items enable row level security;

-- Citire: orice utilizator autentificat (adică voi doi)
create policy "profiles_read" on public.profiles for select to authenticated using (true);
create policy "items_read"    on public.items    for select to authenticated using (true);
-- Scriere: doar proprietarul
create policy "items_insert" on public.items for insert to authenticated with check (owner_id = auth.uid());
create policy "items_update" on public.items for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "items_delete" on public.items for delete to authenticated using (owner_id = auth.uid());

-- Profil creat automat la crearea contului
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
