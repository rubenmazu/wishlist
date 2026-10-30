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
import ThemeToggle from './ui/ThemeToggle';
import AddPanel from './ui/AddPanel';

const money = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' });

function Fields({ item }) {
  return (
    <div className="stack">
      <input name="title" placeholder="Ce vrei?" defaultValue={item?.title} maxLength={120} required />
      <input name="url" placeholder="Link (optional)" defaultValue={item?.url ?? ''} inputMode="url" />
      <input name="price" placeholder="Pret in RON (optional)" defaultValue={item?.price ?? ''} inputMode="decimal" />
      <textarea name="note" placeholder="Nota: marime, culoare, magazin..." defaultValue={item?.note ?? ''} maxLength={500} rows={2} />
    </div>
  );
}

function SortControl({ view, current }) {
  const opts = [
    ['position', 'Ordinea mea'],
    ['priority', 'Prioritate'],
    ['price', 'Pret'],
    ['date', 'Data'],
  ];
  const base = view === 'partner' ? '/?view=partner' : '/';
  const sep = base.includes('?') ? '&' : '?';
  return (
    <nav className="sort" aria-label="Sorteaza">
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

// Continutul unui produs propriu (fara wrapper card — cardul e pus de parinte)
function OwnItemContent({ it }) {
  return (
    <details className="item-details">
      <summary className="item-summary">
        <div className="title-row">
          {it.priority ? <span className="star">★</span> : null}
          <h2>{it.title}</h2>
        </div>
        <div className="right">
          {it.price != null && <span className="price">{money.format(it.price)}</span>}
          <span className="chevron">▼</span>
        </div>
      </summary>
      <div className="item-body">
        {it.note && <p className="muted">{it.note}</p>}
        {it.url && <LinkActions url={it.url} />}
        <div className="item-actions">
          <form action={setPriority}>
            <input type="hidden" name="id" value={it.id} />
            <input type="hidden" name="value" value={it.priority ? '0' : '1'} />
            <button className="chip">{it.priority ? 'Scoate prioritatea' : '★ Prioritate'}</button>
          </form>
          <details className="edit">
            <summary>Editeaza</summary>
            <form action={updateItem} className="panel">
              <input type="hidden" name="id" value={it.id} />
              <Fields item={it} />
              <div className="actions">
                <button className="btn primary">Salveaza</button>
                <ConfirmButton formAction={deleteItem} className="btn danger" message="Sigur stergi acest produs?">Sterge</ConfirmButton>
              </div>
            </form>
          </details>
        </div>
      </div>
    </details>
  );
}

// Continutul unui produs al partenerului
function PartnerItemContent({ it }) {
  return (
    <details className={`item-details${it.purchased ? ' bought' : ''}`}>
      <summary className="item-summary">
        <div className="title-row">
          {it.priority ? <span className="star">★</span> : null}
          <h2>{it.title}</h2>
        </div>
        <div className="right">
          {it.price != null && <span className="price">{money.format(it.price)}</span>}
          <span className="chevron">▼</span>
        </div>
      </summary>
      <div className="item-body">
        {it.note && <p className="muted">{it.note}</p>}
        {it.private_note && <p className="private-note">🔒 {it.private_note}</p>}
        {it.url && <LinkActions url={it.url} />}
        <div className="item-actions">
          <form action={togglePurchased}>
            <input type="hidden" name="item_id" value={it.id} />
            <button className="chip">{it.purchased ? 'Anuleaza cumparat' : '✓ Marcheaza cumparat'}</button>
          </form>
          <details className="edit">
            <summary>Nota privata</summary>
            <form action={savePrivateNote} className="panel">
              <input type="hidden" name="item_id" value={it.id} />
              <textarea name="note" placeholder="Doar tu vezi asta..." defaultValue={it.private_note ?? ''} maxLength={500} rows={2} />
              <button className="btn primary">Salveaza nota</button>
            </form>
          </details>
        </div>
      </div>
    </details>
  );
}

// Continutul unei idei de cadou private
function GiftIdeaContent({ it }) {
  return (
    <details className="item-details idea-details">
      <summary className="item-summary">
        <div className="title-row">
          <span className="idea-badge">Idee</span>
          <h2>{it.title}</h2>
        </div>
        <div className="right">
          {it.price != null && <span className="price">{money.format(it.price)}</span>}
          <span className="chevron">▼</span>
        </div>
      </summary>
      <div className="item-body">
        {it.note && <p className="muted">{it.note}</p>}
        {it.url && <LinkActions url={it.url} />}
        <div className="item-actions">
          <details className="edit">
            <summary>Editeaza ideea</summary>
            <form action={updateGiftIdea} className="panel">
              <input type="hidden" name="id" value={it.id} />
              <Fields item={it} />
              <div className="actions">
                <button className="btn primary">Salveaza</button>
                <ConfirmButton formAction={deleteGiftIdea} className="btn danger" message="Sigur stergi aceasta idee?">Sterge</ConfirmButton>
              </div>
            </form>
          </details>
        </div>
      </div>
    </details>
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
  const canReorder = !sort || sort === 'position';

  function renderItem(it) {
    if (own) return <OwnItemContent it={it} />;
    if (it.kind === 'idea') return <GiftIdeaContent it={it} />;
    return <PartnerItemContent it={it} />;
  }

  return (
    <main className="wrap">
      <div className="app-header">
        <span className="app-title">💝 Wishlist</span>
      </div>

      <nav className="tabs" aria-label="Alege wishlistul">
        <Link href="/" className={own ? 'on' : ''}>{me.name}</Link>
        {partner
          ? <Link href="/?view=partner" className={!own ? 'on' : ''}>{partner.name}</Link>
          : <span className="muted">Al doilea cont nu e creat inca</span>}
      </nav>

      <header className="head">
        <h1>{own ? 'Wishlistul tau' : `Wishlistul lui ${target.name}`}</h1>
        <div className="head-actions">
          <ThemeToggle />
          <form action={logout}><button className="btn ghost">Iesi</button></form>
        </div>
      </header>

      <div className="toolbar">
        <SortControl view={view} current={sort} />
        {budget > 0 && <span className="budget" title="Suma preturilor afisate">Total: {money.format(budget)}</span>}
      </div>

      {own && (
        <AddPanel action={addItem} summary="+ Adauga un produs">
          <Fields />
        </AddPanel>
      )}

      {!own && (
        <AddPanel action={addGiftIdea} summary="+ Adauga o idee privata">
          <input type="hidden" name="target_owner_id" value={partner.id} />
          <Fields />
          <p className="muted small">Doar tu vei vedea aceasta idee.</p>
        </AddPanel>
      )}

      {entries.length === 0 && (
        <p className="muted empty">{own ? 'Lista e goala. Adauga primul produs.' : `${target.name} nu a adaugat nimic inca.`}</p>
      )}

      {entries.length > 0 && (
        <ul className="list">
          {entries.map((it) => (
            <li key={`${it.kind}:${it.id}`} className="item">
              {own
                ? <OwnItemContent it={it} />
                : it.kind === 'idea'
                  ? <GiftIdeaContent it={it} />
                  : <PartnerItemContent it={it} />}
            </li>
          ))}
        </ul>
      )}

      <footer className="footer">
        <span>Crafted with <span className="footer-heart">♥</span> by <strong>Ruben</strong></span>
        <span className="footer-dot">·</span>
        <span>Software Engineer</span>
        <span className="footer-dot">·</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}
