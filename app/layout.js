import './globals.css';

export const metadata = { title: 'Wishlist', description: 'Dorințele noastre' };

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
