import './globals.css';
import RegisterSW from './ui/RegisterSW';

export const metadata = {
  title: 'Wishlist',
  description: 'Dorințele noastre',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Wishlist' },
  icons: { apple: '/apple-touch-icon.png' },
};

export const viewport = {
  themeColor: '#9c2f52',
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ro">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
