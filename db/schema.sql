-- Schema SQLite (Turso / libSQL).
-- Rulată automat de scripts/seed.mjs; o ai aici doar ca referință.

create table if not exists profiles (
  id            text primary key,
  email         text not null unique,
  name          text not null,
  password_hash text not null
);

-- Produsele owner-ului. priority + position sunt publice (vizibile partenerului).
create table if not exists items (
  id         text primary key,
  owner_id   text not null references profiles(id) on delete cascade,
  title      text not null check (length(title) between 1 and 120),
  url        text,
  price      real check (price is null or price >= 0),
  note       text check (note is null or length(note) <= 500),
  priority   integer not null default 0,
  position   real,
  created_at text not null default (datetime('now'))
);
create index if not exists items_owner_created on items (owner_id, created_at desc);

-- Stratul privat al unui viewer peste produsele altui owner.
-- O singură linie per (viewer, produs). Toate câmpurile sunt private.
create table if not exists viewer_item_state (
  viewer_id    text not null references profiles(id) on delete cascade,
  item_id      text not null references items(id) on delete cascade,
  purchased    integer not null default 0,
  position     real,
  private_note text check (private_note is null or length(private_note) <= 500),
  primary key (viewer_id, item_id)
);

-- Idei de cadou private: vizibile DOAR autorului, în contextul listei target_owner_id.
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
create index if not exists gift_ideas_author_target on gift_ideas (author_id, target_owner_id);
