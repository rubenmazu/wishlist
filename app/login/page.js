import { login } from '../actions';
import ThemeToggle from '../ui/ThemeToggle';

export default async function Login({ searchParams }) {
  const { error } = await searchParams;
  return (
    <main className="wrap narrow">
      <div style={{ position: 'fixed', top: '16px', right: '16px' }}>
        <ThemeToggle />
      </div>
      <h1 className="brand">Wishlist</h1>
      <p className="muted">Intra in contul tau.</p>
      <form action={login} className="login-card">
        <input name="name" type="text" placeholder="Numele tau (Marta sau Ruben)" autoComplete="username" required />
        <input name="password" type="password" placeholder="Parola" autoComplete="current-password" required />
        {error && <p className="err" role="alert">Nume sau parola gresita.</p>}
        <button className="btn primary">Intra</button>
      </form>
    </main>
  );
}
