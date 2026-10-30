// Creează/actualizează schema. Idempotent: poate fi rulat de câte ori.
// Folosit de scripts/seed.mjs și de scripts/check.mjs.

export async function migrate(db) {
  await db.execute(`create table if not exists profiles (
    id text primary key,
    email text not null unique,
    name text not null,
    password_hash text not null
  )`);

  await db.execute(`create table if not exists items (
    id text primary key,
    owner_id text not null references profiles(id) on delete cascade,
    title text not null check (length(title) between 1 and 120),
    url text,
    price real check (price is null or price >= 0),
    note text check (note is null or length(note) <= 500),
    priority integer not null default 0,
    position real,
    created_at text not null default (datetime('now'))
  )`);
  await db.execute(
    'create index if not exists items_owner_created on items (owner_id, created_at desc)'
  );

  await db.execute(`create table if not exists viewer_item_state (
    viewer_id text not null references profiles(id) on delete cascade,
    item_id text not null references items(id) on delete cascade,
    purchased integer not null default 0,
    position real,
    private_note text check (private_note is null or length(private_note) <= 500),
    primary key (viewer_id, item_id)
  )`);

  await db.execute(`create table if not exists gift_ideas (
    id text primary key,
    author_id text not null references profiles(id) on delete cascade,
    target_owner_id text not null references profiles(id) on delete cascade,
    title text not null check (length(title) between 1 and 120),
    url text,
    price real check (price is null or price >= 0),
    note text check (note is null or length(note) <= 500),
    position real,
    created_at text not null default (datetime('now'))
  )`);
  await db.execute(
    'create index if not exists gift_ideas_author_target on gift_ideas (author_id, target_owner_id)'
  );

  // Migrare defensivă: adaugă coloanele noi pe items dacă baza e veche.
  // SQLite nu are "ADD COLUMN IF NOT EXISTS", deci inspectăm întâi.
  const info = await db.execute('PRAGMA table_info(items)');
  const cols = new Set(info.rows.map((r) => r.name));

  if (!cols.has('priority')) {
    await db.execute('ALTER TABLE items ADD COLUMN priority integer not null default 0');
  }
  if (!cols.has('position')) {
    await db.execute('ALTER TABLE items ADD COLUMN position real');
    // Inițializează position din created_at: cele mai noi primesc poziții mai mici,
    // păstrând ordinea curentă (created_at desc) ca ordine implicită.
    const { rows } = await db.execute(
      'select id from items order by created_at desc'
    );
    let pos = 0;
    for (const row of rows) {
      await db.execute({
        sql: 'update items set position = ? where id = ?',
        args: [pos, row.id],
      });
      pos += 1;
    }
  }
}
