// middleware.ts
//
// Server-side gate for everything under /admin except the login page itself.
// Runs before any /admin/* page renders, so visiting a URL like
// /admin/contractors/new directly no longer shows the form to a logged-out
// visitor — it redirects to /admin (the login page) instead.
//
// Verifies the same signed session token src/lib/admin-auth.ts issues (see
// that file's header comment for why it's a signed token now, not the raw
// password). This file can't just import verifySessionToken from there,
// though: Next.js Middleware runs on the Edge runtime, which doesn't have
// Node's `crypto` module (createHmac, timingSafeEqual) — only the Web
// Crypto API (`crypto.subtle`). So the HMAC verification is reimplemented
// here using SubtleCrypto instead. If the token format in admin-auth.ts
// ever changes, this needs updating to match — they're two
// implementations of the same check, not one shared function, because the
// runtimes don't share a crypto API.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE_NAME = 'bb_admin_session';

async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const [payload, signatureHex] = token.split('.');
  if (!payload || !signatureHex) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const secret = process.env.ADMIN_PASSWORD ?? '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expectedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Both are fixed-length hex strings from the same HMAC-SHA256 output, so
  // a simple length-then-content check here doesn't leak meaningful timing
  // information the way comparing user-controlled-length input would —
  // unlike the old raw-password comparison this replaces.
  if (expectedHex.length !== signatureHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    mismatch |= expectedHex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(req: NextRequest) {
  // /admin itself is the login page — never gate it, or a logged-out
  // visitor gets redirected to /admin, which redirects to /admin, forever.
  if (req.nextUrl.pathname === '/admin') {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!(await verifySessionToken(token))) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
}

// Protects every /admin/* subpage. Does NOT need to cover /api/admin/*:
// those routes already call isAdminAuthenticated() themselves and return
// 401 on their own — this is just for the page UI.
export const config = {
  matcher: ['/admin/:path*'],
};
