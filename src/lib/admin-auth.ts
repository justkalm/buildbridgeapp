// src/lib/admin-auth.ts
//
// A deliberately simple gate for the admin contractor-add page: one shared
// password, stored in ADMIN_PASSWORD, checked once at login. After that,
// the browser holds a signed SESSION TOKEN — not the password itself.
//
// Why this matters: the cookie used to literally contain ADMIN_PASSWORD in
// plain text. Any leak of that cookie (browser extension, shared machine,
// a future logging bug, a misconfigured proxy) would hand over the actual
// admin credential, permanently, until manually rotated. A signed token
// instead expires on its own (7 days) and reveals nothing about the
// password even if intercepted — the HMAC signature can't be reversed to
// recover the secret it was signed with.
//
// The token format is `${expiryTimestamp}.${hmacSignature}`, signed with
// ADMIN_PASSWORD as the HMAC key. Verifying just recomputes the signature
// and does a constant-time comparison — no need for a session table or
// database lookup, which matters because middleware.ts (the page-level
// gate) can't touch Prisma.
//
// This is still NOT real per-user auth — there's no user record, no
// per-admin audit trail, and the password is a single shared secret. That
// tradeoff is fine while it's just you adding contractors by hand. The
// moment a second person needs admin access, or you want to know *who*
// verified a given contractor, replace this with a real admin user table.

import { cookies } from 'next/headers';
import crypto from 'crypto';

const ADMIN_COOKIE_NAME = 'bb_admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sign(payload: string): string {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSignature = sign(payload);

  // Constant-time comparison — a naive === here would leak how many
  // leading characters of the signature matched via response timing,
  // letting an attacker forge a valid token byte-by-byte over many
  // requests. timingSafeEqual closes that. Both buffers must be equal
  // length before comparing, or it throws.
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(provided, expected);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
