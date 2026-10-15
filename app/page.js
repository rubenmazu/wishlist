import Link from 'next/link';
import { createClient } from '../lib/supabase/server';
import { addItem, updateItem, deleteItem, logout } from './actions';

const money = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' });

function Fields({ item }) {
  return (
    <div className="stack">
      <input name="title" placeholder="Ce îți dorești?" defaultValue={item?.title} maxLength={120} required />
      <input name="url" placeholder="Link (opțional)" defaultValue={item?.url ?? ''} inputMode="url" />
      <input name="price" placeholder="Preț în RON (opțional)" defaultValue={item?.price ?? ''} inputMode="decimal" />
      <textarea name="note" placeholder="Notă: mărime, culoare, magazin…" defaultValue={item?.note ?? ''} maxLength={500} rows={2} />
    </div>
  );
}

export default async function Home({ searchParams }) {
  const { view } = await searchParams;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: people } = await sb.from('profiles').select('id,name').order('name');
  const list = people ?? [];
  const me = list.find((p) => p.id === user.id) ?? { id: user.id, name: 'Tu' };
  const partner = list.find((p) => p.id !== user.id);
  const target = view === 'partner' && partner ? partner : me;
  const own = target.id === user.id;

  const { data: rows } = await sb
    .from('items').select('*').eq('owner_id', target.id).order('created_at', { ascending: false });
  const items = rows ?? [];

  return (
    <main className="wrap">
      <nav className="tabs" aria-label="Alege wishlistul">
        <Link href="/" className={own ? 'on' : ''}>{me.name}</Link>
        {partner
          ? <Link href="/?view=partner" className={!own ? 'on' : ''}>{partner.name}</Link>
          : <span className="muted">Al doilea cont nu e creat încă</span>}
      </nav>

      <header className="head">
        <h1>{own ? 'Wishlistul tău' : `Wishlistul lui ${target.name}`}</h1>
        <form action={logout}><button className="btn ghost">Ieși</button></form>
      </header>

      {own && (
        <details className="add">
          <summary className="btn primary">Adaugă un produs</summary>
          <form action={addItem} className="panel">
            <Fields />
            <button className="btn primary">Adaugă</button>
          </form>
        </details>
      )}

      {items.length === 0 && (
        <p className="muted empty">{own ? 'Lista e goală. Adaugă primul lucru pe care ți l-ai dori.' : `${target.name} n-a adăugat nimic încă.`}</p>
      )}

      <ul className="list">
        {items.map((it) => (
          <li key={it.id} className="item">
            <div className="row">
              <h2>{it.title}</h2>
              {it.price != null && <span className="price">{money.format(it.price)}</span>}
            </div>
            {it.note && <p className="muted">{it.note}</p>}
            {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="link">Vezi produsul</a>}
            {own && (
              <details className="edit">
                <summary>Editează</summary>
                <form action={updateItem} className="panel">
                  <input type="hidden" name="id" value={it.id} />
                  <Fields item={it} />
                  <div className="actions">
                    <button className="btn primary">Salvează</button>
                    <button className="btn danger" formAction={deleteItem}>Șterge</button>
                  </div>
                </form>
              </details>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
