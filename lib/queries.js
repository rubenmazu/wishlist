import { db } from './db';

// Sortări disponibile din UI (query param ?sort=).
export const SORTS = ['position', 'price', 'date', 'priority'];

function normalizeSort(sort) {
  return SORTS.includes(sort) ? sort : 'position';
}

// Comparator pentru o sortare dată. Nu mută produsele cumpărate — asta se face separat.
function comparator(sort) {
  switch (sort) {
    case 'price':
      // Crescător după preț; fără preț la final.
      return (a, b) => {
        const ap = a.price, bp = b.price;
        if (ap == null && bp == null) return byPosition(a, b);
        if (ap == null) return 1;
        if (bp == null) return -1;
        return ap - bp || byPosition(a, b);
      };
    case 'date':
      // Cele mai noi întâi.
      return (a, b) => String(b.created_at).localeCompare(String(a.created_at));
    case 'priority':
      // Prioritate înainte; apoi ordinea personală.
      return (a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || byPosition(a, b);
    case 'position':
    default:
      return byPosition;
  }
}

function byPosition(a, b) {
  const ap = a.position == null ? Infinity : a.position;
  const bp = b.position == null ? Infinity : b.position;
  return ap - bp;
}

// Lista proprie: produsele owner-ului. NICIUN join pe stratul privat (izolare R7).
export async function getOwnList(userId, sort) {
  const { rows } = await db.execute({
    sql: 'select * from items where owner_id = ?',
    args: [userId],
  });
  const items = rows.map((r) => ({ ...r, kind: 'item', priority: !!r.priority }));
  items.sort(comparator(normalizeSort(sort)));
  return items;
}

// Lista partenerului în perspectiva viewer-ului:
// produsele owner-ului + stratul privat al viewer-ului + ideile private ale viewer-ului.
export async function getPartnerList(viewerId, ownerId, sort) {
  const [itemsRes, ideasRes] = await Promise.all([
    db.execute({
      sql: `select i.*, s.purchased as my_purchased, s.position as my_position, s.private_note as my_note
            from items i
            left join viewer_item_state s on s.item_id = i.id and s.viewer_id = ?
            where i.owner_id = ?`,
      args: [viewerId, ownerId],
    }),
    db.execute({
      sql: `select * from gift_ideas where author_id = ? and target_owner_id = ?`,
      args: [viewerId, ownerId],
    }),
  ]);

  const items = itemsRes.rows.map((r) => ({
    ...r,
    kind: 'item',
    priority: !!r.priority,
    purchased: !!r.my_purchased,
    private_note: r.my_note ?? null,
    // Pentru ordinea personală a viewer-ului: folosește my_position dacă există,
    // altfel cade pe position-ul owner-ului, altfel la final.
    position: r.my_position ?? r.position,
  }));

  const ideas = ideasRes.rows.map((r) => ({
    ...r,
    kind: 'idea',
    priority: false,
    purchased: false,
    private_note: null,
  }));

  const all = [...items, ...ideas];
  all.sort(comparator(normalizeSort(sort)));

  // Regula „cumpărat la final", peste orice sortare (R3.2, R8.5).
  all.sort((a, b) => (a.purchased ? 1 : 0) - (b.purchased ? 1 : 0));

  return all;
}

// Suma prețurilor dintr-un set afișat (buget total). Exclude intrările fără preț.
export function totalBudget(entries) {
  return entries.reduce((sum, e) => sum + (typeof e.price === 'number' ? e.price : 0), 0);
}
