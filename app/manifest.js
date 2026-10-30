export default function manifest() {
  return {
    name: 'Wishlist',
    short_name: 'Wishlist',
    description: 'Dorințele noastre',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f4f1',
    theme_color: '#9c2f52',
    lang: 'ro',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
