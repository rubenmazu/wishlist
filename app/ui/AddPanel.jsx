'use client';
import { useRef, useTransition } from 'react';

// Wrapper pentru panoul de adaugare — inchide <details> dupa submit reusit.
export default function AddPanel({ action, summary, children }) {
  const ref = useRef(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    startTransition(async () => {
      await action(fd);
      // Inchide panoul si reseteaza formularul
      if (ref.current) ref.current.open = false;
      e.target.reset();
    });
  }

  return (
    <details className="add" ref={ref}>
      <summary className="btn primary">{summary}</summary>
      <form onSubmit={handleSubmit} className="panel">
        {children}
        <button className="btn primary" disabled={pending}>
          {pending ? 'Se adauga...' : 'Adauga'}
        </button>
      </form>
    </details>
  );
}
