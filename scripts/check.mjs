// Verifică regula critică de izolare a stratului privat (Property 1-4).
// Rulează pe o bază SQLite temporară în memorie. Rulare: node scripts/check.mjs
import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { migrate } from '../db/migrate.mjs';

// Bază izolată în memorie pentru test.
const db = createClient({ url: ':memory:' });

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ ${msg}`);
    failures += 1;
  }
}

// Reimplementăm compunerea listelor direct pe acest db (lib/queries.js folosește
// clientul din lib/db.js; aici vrem baza de test, deci replicăm interogările).
async function getOwnList(userId) {
  const { rows } = await db.execute({
    sql: 'select * from items where owner_id = ?',
    args: [userId],
  });
  return rows;
}

async function getPartnerList(viewerId, ownerId) {
  const items = await db.execute({
    sql: `select i.*, s.purchased as my_purchased, s.position as my_position, s.private_note as my_note
          from items i
          left join viewer_item_state s on s.item_id = i.id and s.viewer_id = ?
          where i.owner_id = ?`,
    args: [viewerId, ownerId],
  });
  const ideas = await db.execute({
    sql: 'select * from gift_ideas where author_id = ? and target_owner_id = ?',
    args: [viewerId, ownerId],
  });
  return { items: items.rows, ideas: ideas.rows };
}

async function main() {
  await migrate(db);

  const A = crypto.randomUUID();
  const B = crypto.randomUUID();
  await db.execute({ sql: 'insert into profiles (id,email,name,password_hash) values (?,?,?,?)', args: [A, 'a@x', 'A', 'x'] });
  await db.execute({ sql: 'insert into profiles (id,email,name,password_hash) values (?,?,?,?)', args: [B, 'b@x', 'B', 'x'] });

  // B are două produse.
  const b1 = crypto.randomUUID();
  const b2 = crypto.randomUUID();
  await db.execute({ sql: 'insert into items (id,owner_id,title,position) values (?,?,?,?)', args: [b1, B, 'Carte', 0] });
  await db.execute({ sql: 'insert into items (id,owner_id,title,position) values (?,?,?,?)', args: [b2, B, 'Cană', 1] });

  // A acționează privat pe lista lui B.
  await db.execute({ sql: 'insert into viewer_item_state (viewer_id,item_id,purchased,position,private_note) values (?,?,?,?,?)', args: [A, b1, 1, 5, 'am luat eu asta'] });
  const ideaId = crypto.randomUUID();
  await db.execute({ sql: 'insert into gift_ideas (id,author_id,target_owner_id,title) values (?,?,?,?)', args: [ideaId, A, B, 'Idee secretă'] });

  console.log('Property 1 & 2: stratul lui A NU apare în lista proprie a lui B');
  const bOwn = await getOwnList(B);
  assert(bOwn.length === 2, 'B vede exact cele 2 produse ale lui');
  assert(!bOwn.some((r) => 'my_purchased' in r || 'private_note' in r && r.private_note), 'B nu vede marcaj cumpărat sau notiță privată a lui A');
  assert(!bOwn.some((r) => r.title === 'Idee secretă'), 'B nu vede ideea privată a lui A');

  console.log('Property 1: A vede stratul lui privat pe lista lui B');
  const aView = await getPartnerList(A, B);
  const purchased = aView.items.find((r) => r.id === b1);
  assert(purchased && purchased.my_purchased === 1, 'A vede marcajul „cumpărat" pus de el');
  assert(purchased && purchased.my_note === 'am luat eu asta', 'A vede nota lui privată');
  assert(aView.ideas.length === 1, 'A vede ideea lui privată');

  console.log('Property 1: stratul lui A nu apare în perspectiva lui B asupra listei lui A');
  const bView = await getPartnerList(B, A);
  assert(bView.ideas.length === 0, 'B nu vede idei private în contextul listei lui A');
  assert(bView.items.length === 0, 'A nu are produse proprii, deci B nu vede nimic');

  console.log('');
  if (failures === 0) {
    console.log('TOATE verificările de izolare au trecut.');
  } else {
    console.error(`${failures} verificări au EȘUAT.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
