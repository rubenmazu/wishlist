import { login } from '../actions';

export default async function Login({ searchParams }) {
  const { error } = await searchParams;
  return (
    <main className="wrap narrow">
      <h1 className="brand">Wishlist</h1>
      <p className="muted">Intră în contul tău.</p>
      <form action={login} className="stack">
        <input name="email" type="email" placeholder="Email" autoComplete="email" required />
        <input name="password" type="password" placeholder="Parolă" autoComplete="current-password" required />
        {error && <p className="err" role="alert">Email sau parolă greșite.</p>}
        <button className="btn primary">Intră</button>
      </form>
    </main>
  );
}
