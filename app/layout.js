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
  themeColor: '#3b9ede',
  viewportFit: 'cover',
};

// Script inline care aplica tema inainte de render — fara flash
const themeScript = `
  (function() {
    try {
      var saved = localStorage.getItem('theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
      }
    } catch(e) {}
  })();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
