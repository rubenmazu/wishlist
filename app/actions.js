'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '../lib/supabase/server';

async function authed() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  return { sb, user };
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

export async function login(f) {
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({
    email: String(f.get('email') || '').trim(),
    password: String(f.get('password') || ''),
  });
  if (error) redirect('/login?error=1');
  redirect('/');
}

export async function logout() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect('/login');
}

export async function addItem(f) {
  const { sb, user } = await authed();
  const v = parse(f);
  if (v) await sb.from('items').insert({ ...v, owner_id: user.id });
  revalidatePath('/');
}

export async function updateItem(f) {
  const { sb, user } = await authed();
  const v = parse(f);
  if (v) await sb.from('items').update(v).eq('id', String(f.get('id'))).eq('owner_id', user.id);
  revalidatePath('/');
}

export async function deleteItem(f) {
  const { sb, user } = await authed();
  await sb.from('items').delete().eq('id', String(f.get('id'))).eq('owner_id', user.id);
  revalidatePath('/');
}
