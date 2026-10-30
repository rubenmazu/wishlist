'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db';
import { getUserId, setSession, clearSession } from '../lib/session';

async function authed() {
  const userId = await getUserId();
  if (!userId) redirect('/login');
  return userId;
}

function parse(f) {
  const title = String(f.get('title') || '').trim().slice(0, 120);
  if (!title) return null;
  let url = String(f.get('url') || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { if (url) new URL(url); } catch { url = ''; }
  const p = parseFloat(String(f.get('price') || '').replace(',', '.'));
  return {
    title,
    url: url || null,
    price: Number.isFinite(p) && p >= 0 && p < 1e8 ? p : null,
    note: String(f.get('note') || '').trim().slice(0, 500) || null,
  };
}

// --- Auth -------------------------------------------------------------------

export async function login(f) {
  const email = String(f.get('email') || '').trim().toLowerCase();
  const password = String(f.get('password') || '');
  const { rows } = await db.execute({
    sql: 'select id, password_hash from profiles where email = ?',
    args: [email],
  });
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) redirect('/login?error=1');
  await setSession(user.id);
  redirect('/');
}

export async function logout() {
  await clearSession();
  redirect('/login');
}

// --- Lista proprie ----------------------------------------------------------

export async function addItem(f) {
  const userId = await authed();
  const v = parse(f);
  if (v) {
    // Poziție la coada listei proprii.
    const { rows } = await db.execute({
      sql: 'select max(position) as m from items where owner_id = ?',
      args: [userId],
    });
    const next = (rows[0]?.m ?? -1) + 1;
    await db.execute({
      sql: 'insert into items (id, owner_id, title, url, price, note, position) values (?, ?, ?, ?, ?, ?, ?)',
      args: [crypto.randomUUID(), userId, v.title, v.url, v.price, v.note, next],
    });
  }
  revalidatePath('/');
}

export async function updateItem(f) {
  const userId = await authed();
  const v = parse(f);
  if (v) {
    await db.execute({
      sql: 'update items set title = ?, url = ?, price = ?, note = ? where id = ? and owner_id = ?',
      args: [v.title, v.url, v.price, v.note, String(f.get('id')), userId],
    });
  }
  revalidatePath('/');
}

export async function deleteItem(f) {
  const userId = await authed();
  await db.execute({
    sql: 'delete from items where id = ? and owner_id = ?',
    args: [String(f.get('id')), userId],
  });
  revalidatePath('/');
}

export async function setPriority(f) {
  const userId = await authed();
  const value = String(f.get('value')) === '1' ? 1 : 0;
  await db.execute({
    sql: 'update items set priority = ? where id = ? and owner_id = ?',
    args: [value, String(f.get('id')), userId],
  });
  revalidatePath('/');
}

export async function reorderOwn(f) {
  const userId = await authed();
  const ids = String(f.get('ids') || '').split(',').filter(Boolean);
  for (let i = 0; i < ids.length; i++) {
    await db.execute({
      sql: 'update items set position = ? where id = ? and owner_id = ?',
      args: [i, ids[i], userId],
    });
  }
  revalidatePath('/');
}

// --- Stratul privat (lista partenerului) ------------------------------------

async function upsertState(viewerId, itemId, column, value) {
  // Coloană controlată intern (nu din input utilizator) => sigur de interpolat.
  await db.execute({
    sql: `insert into viewer_item_state (viewer_id, item_id, ${column})
          values (?, ?, ?)
          on conflict(viewer_id, item_id) do update set ${column} = excluded.${column}`,
    args: [viewerId, itemId, value],
  });
}

export async function togglePurchased(f) {
  const userId = await authed();
  const itemId = String(f.get('item_id'));
  const { rows } = await db.execute({
    sql: 'select purchased from viewer_item_state where viewer_id = ? and item_id = ?',
    args: [userId, itemId],
  });
  const next = rows[0]?.purchased ? 0 : 1;
  await upsertState(userId, itemId, 'purchased', next);
  revalidatePath('/');
}

export async function savePrivateNote(f) {
  const userId = await authed();
  const itemId = String(f.get('item_id'));
  const text = String(f.get('note') || '').trim().slice(0, 500) || null;
  await upsertState(userId, itemId, 'private_note', text);
  revalidatePath('/');
}

export async function reorderPartner(f) {
  const userId = await authed();
  // Fiecare intrare: "kind:id" (ex. "item:abc", "idea:xyz").
  const entries = String(f.get('entries') || '').split(',').filter(Boolean);
  for (let i = 0; i < entries.length; i++) {
    const [kind, id] = entries[i].split(':');
    if (kind === 'item') {
      await upsertState(userId, id, 'position', i);
    } else if (kind === 'idea') {
      await db.execute({
        sql: 'update gift_ideas set position = ? where id = ? and author_id = ?',
        args: [i, id, userId],
      });
    }
  }
  revalidatePath('/');
}

// --- Idei de cadou private --------------------------------------------------

export async function addGiftIdea(f) {
  const userId = await authed();
  const v = parse(f);
  const targetOwnerId = String(f.get('target_owner_id'));
  if (v && targetOwnerId && targetOwnerId !== userId) {
    const { rows } = await db.execute({
      sql: 'select max(position) as m from gift_ideas where author_id = ? and target_owner_id = ?',
      args: [userId, targetOwnerId],
    });
    const next = (rows[0]?.m ?? -1) + 1;
    await db.execute({
      sql: `insert into gift_ideas (id, author_id, target_owner_id, title, url, price, note, position)
            values (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), userId, targetOwnerId, v.title, v.url, v.price, v.note, next],
    });
  }
  revalidatePath('/');
}

export async function updateGiftIdea(f) {
  const userId = await authed();
  const v = parse(f);
  if (v) {
    await db.execute({
      sql: 'update gift_ideas set title = ?, url = ?, price = ?, note = ? where id = ? and author_id = ?',
      args: [v.title, v.url, v.price, v.note, String(f.get('id')), userId],
    });
  }
  revalidatePath('/');
}

export async function deleteGiftIdea(f) {
  const userId = await authed();
  await db.execute({
    sql: 'delete from gift_ideas where id = ? and author_id = ?',
    args: [String(f.get('id')), userId],
  });
  revalidatePath('/');
}
