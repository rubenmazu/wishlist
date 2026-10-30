'use client';
import { useState, useRef, useTransition } from 'react';

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
        setOrder(prev.current);
        setError('Nu am putut salva ordinea. Incearca din nou.');
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
      {error && <li style={{gridColumn:'1/-1'}}><p className="err" role="alert">{error}</p></li>}
      {order.map((key, idx) => (
        <li
          key={key}
          className="item reorderable"
          draggable
          onDragStart={() => { dragKey.current = key; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(key)}
        >
          <div className="reorder-handles">
            <button type="button" className="handle" aria-label="Muta mai sus" onClick={() => move(key, -1)} disabled={idx === 0}>↑</button>
            <button type="button" className="handle" aria-label="Muta mai jos" onClick={() => move(key, 1)} disabled={idx === order.length - 1}>↓</button>
          </div>
          <div className="reorder-body">{byKey.get(key)}</div>
        </li>
      ))}
    </ul>
  );
}
