import type { NextConfig } from "next";

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
    // MIME type (see the upload route comments for the related, separate
    // issue of that type not being independently verified).
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
    // Content-Security-Policy: restricts where scripts, styles, images,
    // and frames can load from. frame-ancestors 'none' is the modern,
    // CSP-level equivalent of X-Frame-Options DENY (kept both since older
    // browsers only respect the header).
    //
    // script-src MUST include 'unsafe-inline': Next.js hydrates every page
    // using inline <script> tags it injects into the server-rendered HTML
    // (serialized page data + the bootstrap script that mounts React).
    // Without 'unsafe-inline' here, the browser silently blocks those
    // scripts from running at all — the page renders as blank white,
    // because the HTML shell loads fine but nothing ever hydrates or
    // executes. This shipped broken once already; don't remove
    // 'unsafe-inline' from script-src without switching to Next.js's
    // nonce-based CSP support first, which is more setup than this slice
    // needs right now. 'unsafe-inline' does weaken XSS protection
    // somewhat, but the app has no dangerouslySetInnerHTML and no
    // unsanitized user-content rendering, so the realistic exposure is
    // low — trading a fully broken site for a moderately-relaxed script
    // policy is the right call here.
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
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
