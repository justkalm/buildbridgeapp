// src/lib/admin-token.ts
//
// The signing half of admin sessions, kept free of Prisma and next/headers
// so both src/lib/admin-auth.ts and proxy.ts can share ONE implementation.
// (Before Next.js 16, the gate ran on the Edge runtime without Node's
// crypto module, so the check had to be written twice. Proxy now runs on
// Node, so that duplication is gone.)
//
// Token format: `${sessionId}.${expiresAt}.${hmac}`, where the HMAC covers
// `${sessionId}.${expiresAt}` and is keyed with ADMIN_SESSION_SECRET.
// A valid signature only proves WE issued the token. Whether the session
// is still allowed (not signed out, not revoked) is the AdminSession row's
// job; see isAdminTokenActive() in admin-auth.ts.
//
// Why a separate ADMIN_SESSION_SECRET instead of signing with
// ADMIN_PASSWORD as before: rotating the session secret now signs every
// admin out without changing the password, and a leaked token can't be
// used to test guesses of the password offline (the HMAC key used to BE
// the password). If ADMIN_SESSION_SECRET is missing we fall back to a key
// derived from ADMIN_PASSWORD and warn, so a forgotten Vercel variable
// doesn't lock admin out; the database row check still applies either way.

import crypto from 'crypto';

let warnedAboutFallback = false;

function signingKey(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret) return secret;
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.error(
      'ADMIN_SESSION_SECRET is not set; admin sessions are signed with a key derived from ADMIN_PASSWORD. Set ADMIN_SESSION_SECRET in .env and Vercel.'
    );
  }
  return crypto
    .createHash('sha256')
    .update(`admin-session:${process.env.ADMIN_PASSWORD ?? ''}`)
    .digest('hex');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('hex');
}

export function newAdminSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createAdminToken(sessionId: string, expiresAt: Date): string {
  const payload = `${sessionId}.${expiresAt.getTime()}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Checks the signature and expiry only. Returns the session id if both
 * pass, otherwise null. Callers must still check the AdminSession row.
 */
export function readAdminToken(token: string | undefined): string | null {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, expiresAtRaw, signature] = parts;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  // Constant-time comparison so response timing can't reveal how much of
  // a forged signature was right. timingSafeEqual needs equal lengths.
  const provided = Buffer.from(signature);
  const expected = Buffer.from(sign(`${sessionId}.${expiresAtRaw}`));
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;

  return sessionId;
}

export const ADMIN_COOKIE_NAME = 'bb_admin_session';
