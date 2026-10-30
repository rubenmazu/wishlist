'use client';

// Buton de submit care cere confirmare înainte de a trimite formularul.
// Se folosește cu `formAction` (ex. ștergere) în interiorul unui <form>.
export default function ConfirmButton({ formAction, children, message, className }) {
  function onClick(e) {
    if (!window.confirm(message || 'Sigur ștergi?')) {
      e.preventDefault();
    }
  }
  return (
    <button type="submit" formAction={formAction} className={className} onClick={onClick}>
      {children}
    </button>
  );
}
