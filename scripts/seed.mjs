// Creează tabelele și cei doi utilizatori. Rulează: npm run seed
// Citește parolele din mediu sau folosește valori implicite (schimbă-le!).
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { migrate } from '../db/migrate.mjs';

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;
const db = createClient(authToken ? { url, authToken } : { url });

const users = [
  {
    email: (process.env.MARTA_EMAIL || 'marta@wishlist.local').toLowerCase(),
    name: 'Marta',
    password: process.env.MARTA_PASSWORD || 'schimba-ma',
  },
  {
    email: (process.env.RUBEN_EMAIL || 'ruben@wishlist.local').toLowerCase(),
    name: 'Ruben',
    password: process.env.RUBEN_PASSWORD || 'schimba-ma',
  },
];

async function main() {
  await migrate(db);

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    // Upsert pe email: creează sau actualizează numele + parola.
    await db.execute({
      sql: `insert into profiles (id, email, name, password_hash)
            values (?, ?, ?, ?)
            on conflict(email) do update set name = excluded.name, password_hash = excluded.password_hash`,
      args: [crypto.randomUUID(), u.email, u.name, hash],
    });
    console.log(`✓ ${u.name} <${u.email}>`);
  }

  console.log('\nGata. Dacă ai folosit parolele implicite, schimbă-le și rulează din nou.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
