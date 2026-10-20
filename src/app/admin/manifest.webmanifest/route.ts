// src/app/admin/manifest.webmanifest/route.ts
//
// A separate Home Screen app for admin (20 Oct 2026). The site's own app
// (src/app/manifest.ts) always opens on the home page and has no address
// bar, so a partner who added (kalm) to the Home Screen had no way to reach
// /admin, and on iPhone admin phone alerts only work from a Home Screen
// app. Adding the site to the Home Screen while on /admin now creates
// "(kalm) admin", which opens straight on the admin login. Its own id keeps
// it apart from the public app on the same phone. Linked from the admin
// layout's metadata. Holds nothing secret: same icons, admin address only.

export function GET() {
  return Response.json(
    {
      id: '/admin',
      name: '(kalm) admin',
      short_name: 'kalm admin',
      start_url: '/admin',
      scope: '/',
      display: 'standalone',
      background_color: '#fafaf8',
      theme_color: '#fafaf8',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
