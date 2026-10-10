import type { NextConfig } from "next";
import { SEARCH_ENGINES_ALLOWED } from "./src/lib/site";

// Security headers applied to every response. Next.js had none configured
// before this — meaning no clickjacking protection on login pages (an
// attacker could iframe /login or /admin invisibly on their own page and
// trick a logged-in visitor into clicking through it), no baseline CSP,
// and no explicit MIME-sniffing lockdown. These are the standard,
// low-risk-of-breakage headers; none of them restrict anything the app
// currently does.
const securityHeaders = [
  {
    // Blocks the entire site from being embedded in an iframe on another
    // origin — the core clickjacking defense. DENY rather than SAMEORIGIN
    // since nothing here legitimately needs to be iframed, including by
    // this same site.
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Stops the browser from guessing content types based on file
    // contents rather than trusting the declared Content-Type header —
    // relevant given the upload routes accept files by client-reported
    // MIME type.
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Forces HTTPS for a year, including subdomains, once a browser has
    // seen this header once — protects against a downgrade to plain HTTP
    // on a future visit. `preload` opts into browsers' built-in HSTS
    // preload lists; harmless to include even before actually submitting
    // to the preload list.
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // Limits how much of this site's URLs leak to external sites via the
    // Referer header when someone clicks an outbound link — sends full
    // detail same-origin, only the origin cross-origin.
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Switches off the browser's camera, microphone and location for this
    // site (and anything embedded in it). The site uses none of them, so if a
    // script were ever injected it could not ask for them. Notifications,
    // which the site does use, are not affected.
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  // Until launch, every response also says "don't list this" to search
  // engines, alongside the robots meta tag (see SEARCH_ENGINES_ALLOWED in
  // src/lib/site.ts). The header covers non-HTML responses too.
  ...(SEARCH_ENGINES_ALLOWED ? [] : [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]),
  // Content-Security-Policy is NOT set here any more. It needs a fresh
  // nonce on every page view, so proxy.ts builds it per request (task
  // sheet F6; see the header comment there).
];

const nextConfig: NextConfig = {
  // Stops every response announcing "X-Powered-By: Next.js" (tells an attacker
  // which framework to aim at, and helps nobody else).
  poweredByHeader: false,
  // DEVELOPMENT ONLY: lets a phone on the same Wi-Fi open the local dev
  // site at http://<this laptop's Wi-Fi address>:3000 for testing. Next.js
  // blocks dev-server requests from any host but localhost unless listed
  // here. The laptop's address can change when the router hands out a new
  // one; if phone testing stops working, find the new address with
  // `ipconfig getifaddr en0` and update it here. No effect on the live site.
  allowedDevOrigins: ['192.168.0.157'],
  // Hosts next/image may fetch and optimise (resize, compress, convert to
  // modern formats) images from. Anything else is refused, so the image
  // optimiser can't be used to proxy arbitrary URLs.
  //   - Vercel Blob: every logo and project photo uploaded through the app
  //     (see src/lib/validate-image-url.ts);
  //   - picsum.photos (+ its fastly CDN, which it redirects to): placeholder
  //     photos used only by the DEMO contractors in prisma/seed-demo.ts.
  //     Remove these two once the demo contractors are gone.
  images: {
    remotePatterns: [
      new URL('https://*.public.blob.vercel-storage.com/**'),
      new URL('https://picsum.photos/**'),
      new URL('https://fastly.picsum.photos/**'),
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
