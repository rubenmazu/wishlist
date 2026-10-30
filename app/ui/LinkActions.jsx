'use client';
import { useState } from 'react';

export default function LinkActions({ url }) {
  const [msg, setMsg] = useState('');

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback pentru browsere/contexte fără Clipboard API.
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setMsg('Link copiat');
    } catch {
      setMsg('Nu am putut copia linkul');
    }
    setTimeout(() => setMsg(''), 2000);
  }

  return (
    <span className="link-actions">
      <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="link">Vezi produsul</a>
      <button type="button" className="link-copy" onClick={copy} aria-label="Copiază linkul">Copiază</button>
      {msg && <span className="link-msg" role="status">{msg}</span>}
    </span>
  );
}
