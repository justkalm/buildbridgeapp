// proxy.ts
//
// Runs before every page request (Next.js 16 renamed Middleware to Proxy;
// it now runs on the Node.js runtime). It does two jobs:
//
// 1. CONTENT SECURITY POLICY WITH A NONCE (task sheet F6). Every page view
//    gets a fresh random "nonce" and a CSP header that only lets scripts
//    carrying that exact nonce run. Next.js reads the nonce from the CSP
//    header during rendering and stamps it on its own scripts
//    automatically. An attacker who manages to inject a <script> into a
//    page can't know this request's nonce, so the browser refuses to run
//    it. This replaces the old 'unsafe-inline' script policy, which let ANY
//    inline script run.
//    Cost: nonces only work on pages rendered per request, so the root
//    layout forces dynamic rendering (await connection() in
//    src/app/layout.tsx). Pages are no longer pre-built and cached; at our
//    traffic this is fine.
//    'strict-dynamic' lets scripts that a trusted (nonce-carrying) script
//    loads also run, which is how Next.js loads its page chunks.
//    style-src keeps 'unsafe-inline' on purpose: React writes style=""
//    attributes, which nonces can't cover, and style injection is far less
//    dangerous than script injection.
//    'unsafe-eval' is added ONLY in development (React's dev tools use
//    eval; production never does). upgrade-insecure-requests is added only
//    in production, so phone testing over the laptop's plain-http Wi-Fi
//    address keeps working.
//
// 2. ADMIN PAGE GATE. Every /admin/* page except /admin itself (the login
//    form) redirects to /admin unless the visitor has an ACTIVE admin
//    session: valid signature, not expired, not signed out or revoked (see
//    src/lib/admin-auth.ts). API routes under /api/admin check the same
//    thing themselves, so this matcher doesn't cover /api.
//
// 3. OLD ADDRESS (17 Oct 2026). Pages opened on the old address
//    kalm-gold.vercel.app are sent, permanently (308), to the same page on
//    the real address (SITE_URL, app.justkalm.in on the live site). That
//    way Google only ever learns one address, and old links and bookmarks
//    still work. API calls are not redirected (the matcher skips /api).

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAdminTokenActive } from '@/lib/admin-auth';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-token';
import { SITE_URL } from '@/lib/site';

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

const OLD_HOSTS = new Set(['kalm-gold.vercel.app']);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim().toLowerCase();
  if (OLD_HOSTS.has(host)) {
    const target = new URL(SITE_URL);
    // Only if the real address is somewhere else, so a missing NEXTAUTH_URL
    // (SITE_URL then falls back to the old address) can't cause a loop.
    if (target.host !== host) {
      target.pathname = pathname;
      target.search = req.nextUrl.search;
      return NextResponse.redirect(target, 308);
    }
  }

  // /admin itself is the login page: never gate it, or a logged-out
  // visitor would be redirected to /admin, forever.
  if (pathname.startsWith('/admin/')) {
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!(await isAdminTokenActive(token))) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce);

  // The CSP goes on the REQUEST too: that's where Next.js looks for the
  // nonce while rendering the page.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

// Every page, but not API routes (JSON, no scripts), Next's static files
// and image optimiser, or the files in /public (icons, sw.js), which have
// a dot in their name.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};
