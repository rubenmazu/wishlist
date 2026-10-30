import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '../lib/db';
import { getUserId } from '../lib/session';
import { getOwnList, getPartnerList, totalBudget } from '../lib/queries';
import {
  addItem, updateItem, deleteItem, setPriority, logout,
  togglePurchased, savePrivateNote,
  addGiftIdea, updateGiftIdea, deleteGiftIdea,
  reorderOwn, reorderPartner,
} from './actions';
import LinkActions from './ui/LinkActions';
import ConfirmButton from './ui/ConfirmButton';
import ReorderList from './ui/ReorderList';

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

function SortControl({ view, current }) {
  const opts = [
    ['position', 'Ordinea mea'],
    ['priority', 'Prioritate'],
    ['price', 'Preț'],
    ['date', 'Dată'],
  ];
  const base = view === 'partner' ? '/?view=partner' : '/';
  const sep = base.includes('?') ? '&' : '?';
  return (
    <nav className="sort" aria-label="Sortează">
      {opts.map(([val, label]) => (
        <Link
          key={val}
          href={val === 'position' ? base : `${base}${sep}sort=${val}`}
          className={(current || 'position') === val ? 'on' : ''}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

// Un produs de pe lista proprie.
function OwnItem({ it }) {
  return (
    <>
      <div className="row">
        <h2>{it.priority ? <span className="star" title="Îmi doresc tare asta">★</span> : null}{it.title}</h2>
        {it.price != null && <span className="price">{money.format(it.price)}</span>}
      </div>
      {it.note && <p className="muted">{it.note}</p>}
      {it.url && <LinkActions url={it.url} />}
      <div className="item-actions">
        <form action={setPriority}>
          <input type="hidden" name="id" value={it.id} />
          <input type="hidden" name="value" value={it.priority ? '0' : '1'} />
          <button className="chip">{it.priority ? 'Scoate prioritatea' : 'Prioritate ★'}</button>
        </form>
        <details className="edit">
          <summary>Editează</summary>
          <form action={updateItem} className="panel">
            <input type="hidden" name="id" value={it.id} />
            <Fields item={it} />
            <div className="actions">
              <button className="btn primary">Salvează</button>
              <ConfirmButton formAction={deleteItem} className="btn danger" message="Sigur ștergi acest produs?">Șterge</ConfirmButton>
            </div>
          </form>
        </details>
      </div>
    </>
  );
}

// Un produs al partenerului, cu stratul privat al viewer-ului.
function PartnerItem({ it }) {
  return (
    <div className={it.purchased ? 'bought' : ''}>
      <div className="row">
        <h2>{it.priority ? <span className="star" title="Și-l dorește tare">★</span> : null}{it.title}</h2>
        {it.price != null && <span className="price">{money.format(it.price)}</span>}
      </div>
      {it.note && <p className="muted">{it.note}</p>}
      {it.private_note && <p className="private-note">🔒 {it.private_note}</p>}
      {it.url && <LinkActions url={it.url} />}
      <div className="item-actions">
        <form action={togglePurchased}>
          <input type="hidden" name="item_id" value={it.id} />
          <button className="chip">{it.purchased ? 'Anulează „cumpărat”' : 'Marchează cumpărat'}</button>
        </form>
        <details className="edit">
          <summary>Notă privată</summary>
          <form action={savePrivateNote} className="panel">
            <input type="hidden" name="item_id" value={it.id} />
            <textarea name="note" placeholder="Doar tu vezi asta…" defaultValue={it.private_note ?? ''} maxLength={500} rows={2} />
            <button className="btn primary">Salvează nota</button>
          </form>
        </details>
      </div>
    </div>
  );
}

// O idee de cadou privată (distinctă vizual), editabilă de autor.
function GiftIdea({ it }) {
  return (
    <div className="idea">
      <div className="row">
        <h2><span className="idea-badge">Idee</span>{it.title}</h2>
        {it.price != null && <span className="price">{money.format(it.price)}</span>}
      </div>
      {it.note && <p className="muted">{it.note}</p>}
      {it.url && <LinkActions url={it.url} />}
      <details className="edit">
        <summary>Editează ideea</summary>
        <form action={updateGiftIdea} className="panel">
          <input type="hidden" name="id" value={it.id} />
          <Fields item={it} />
          <div className="actions">
            <button className="btn primary">Salvează</button>
            <ConfirmButton formAction={deleteGiftIdea} className="btn danger" message="Sigur ștergi această idee?">Șterge</ConfirmButton>
          </div>
        </form>
      </details>
    </div>
  );
}

export default async function Home({ searchParams }) {
  const { view, sort } = await searchParams;
  const userId = await getUserId();
  if (!userId) redirect('/login');

  const { rows: people } = await db.execute('select id, name from profiles order by name');
  const list = people ?? [];
  const me = list.find((p) => p.id === userId) ?? { id: userId, name: 'Tu' };
  const partner = list.find((p) => p.id !== userId);
  const viewingPartner = view === 'partner' && !!partner;
  const target = viewingPartner ? partner : me;
  const own = !viewingPartner;

  const entries = own
    ? await getOwnList(userId, sort)
    : await getPartnerList(userId, partner.id, sort);

  const budget = totalBudget(entries);
  // Reordonarea manuală are sens doar peste ordinea salvată (fără sortare activă).
  const canReorder = !sort || sort === 'position';

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

      <div className="toolbar">
        <SortControl view={view} current={sort} />
        {budget > 0 && <span className="budget" title="Suma prețurilor afișate">Total: {money.format(budget)}</span>}
      </div>

      {own && (
        <details className="add">
          <summary className="btn primary">Adaugă un produs</summary>
          <form action={addItem} className="panel">
            <Fields />
            <button className="btn primary">Adaugă</button>
          </form>
        </details>
      )}

      {!own && (
        <details className="add">
          <summary className="btn">Adaugă o idee privată</summary>
          <form action={addGiftIdea} className="panel">
            <input type="hidden" name="target_owner_id" value={partner.id} />
            <Fields />
            <p className="muted small">Doar tu vei vedea această idee — {target.name} nu.</p>
            <button className="btn primary">Adaugă ideea</button>
          </form>
        </details>
      )}

      {entries.length === 0 && (
        <p className="muted empty">{own ? 'Lista e goală. Adaugă primul lucru pe care ți l-ai dori.' : `${target.name} n-a adăugat nimic încă.`}</p>
      )}

      {entries.length > 0 && (
        canReorder
          ? (
            <ReorderList
              action={own ? reorderOwn : reorderPartner}
              mode={own ? 'own' : 'partner'}
              entries={entries.map((it) => ({
                key: `${it.kind}:${it.id}`,
                node: own
                  ? <OwnItem it={it} />
                  : it.kind === 'idea' ? <GiftIdea it={it} /> : <PartnerItem it={it} />,
              }))}
            />
          )
          : (
            <ul className="list">
              {entries.map((it) => (
                <li key={`${it.kind}:${it.id}`} className="item">
                  {own
                    ? <OwnItem it={it} />
                    : it.kind === 'idea'
                      ? <GiftIdea it={it} />
                      : <PartnerItem it={it} />}
                </li>
              ))}
            </ul>
          )
      )}
    </main>
  );
}
