'use client';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // La mount: citim preferinta salvata sau cea a sistemului
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <button
      className="btn ghost theme-toggle"
      onClick={toggle}
      aria-label={dark ? 'Mod zi' : 'Mod noapte'}
      title={dark ? 'Mod zi' : 'Mod noapte'}
    >
      {dark ? '🌙' : '☀️'}
    </button>
  );
}
