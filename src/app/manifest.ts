// src/app/manifest.ts
//
// Web app manifest: lets people "Add to Home Screen" and open (kalm) like
// an app (its own icon, no browser bars). It matters most on iPhone,
// where Safari only allows notifications for sites added to the Home
// Screen (iOS 16.4+); see src/components/PushPrompt.tsx. Icons live in
// /public and show the (kalm) wordmark in ink on white (drawn by
// scripts/make-app-icons.cjs, same letters and brackets as the site).

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '(kalm)',
    short_name: '(kalm)',
    description: 'Connecting developers with licensed, verified contractors.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafaf8',
    theme_color: '#fafaf8',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
