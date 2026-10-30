'use client';
import { useState, useRef, useTransition } from 'react';

// Listă reordonabilă. Primește:
// - entries: [{ key, node }]  (key stabil "kind:id" + conținutul randat pe server)
// - action: Server Action
// - mode: 'own' (trimite `ids`) sau 'partner' (trimite `entries` cu "kind:id")
export default function ReorderList({ entries, action, mode }) {
  const field = mode === 'own' ? 'ids' : 'entries';
  const serialize = (keys) =>
    mode === 'own' ? keys.map((k) => k.split(':')[1]).join(',') : keys.join(',');
  const [order, setOrder] = useState(entries.map((e) => e.key));
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const dragKey = useRef(null);
  const prev = useRef(order);

  const byKey = new Map(entries.map((e) => [e.key, e.node]));

  function commit(nextOrder) {
    prev.current = order;
    setOrder(nextOrder);
    setError('');
    const fd = new FormData();
    fd.set(field, serialize(nextOrder));
    start(async () => {
      try {
        await action(fd);
      } catch {
        setOrder(prev.current); // revenire la eroare (R1.4)
        setError('Nu am putut salva ordinea. Încearcă din nou.');
      }
    });
  }

  function move(key, delta) {
    const i = order.indexOf(key);
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  function onDrop(targetKey) {
    const from = order.indexOf(dragKey.current);
    const to = order.indexOf(targetKey);
    if (from < 0 || to < 0 || from === to) return;
    const next = order.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  }

  return (
    <ul className="list" aria-busy={pending}>
      {error && <li className="err" role="alert">{error}</li>}
      {order.map((key) => (
        <li
          key={key}
          className="item reorderable"
          draggable
          onDragStart={() => { dragKey.current = key; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(key)}
        >
          <div className="reorder-handles" aria-hidden="false">
            <button type="button" className="handle" aria-label="Mută mai sus" onClick={() => move(key, -1)}>↑</button>
            <button type="button" className="handle" aria-label="Mută mai jos" onClick={() => move(key, 1)}>↓</button>
          </div>
          <div className="reorder-body">{byKey.get(key)}</div>
        </li>
      ))}
    </ul>
  );
}
