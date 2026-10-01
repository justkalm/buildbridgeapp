// src/lib/admin-auth.ts
//
// A deliberately simple gate for the admin pages: one shared password plus
// a 2FA code (src/app/api/admin/login/route.ts), checked once at login.
// After that, the browser holds a signed SESSION TOKEN, never the password.
//
// Sessions are REVOCABLE (task sheet F1). Each login creates an
// AdminSession row, and the cookie carries that row's id, signed with
// ADMIN_SESSION_SECRET (see src/lib/admin-token.ts for the token format
// and signing). Every admin check verifies the signature AND that the row
// still exists, isn't revoked and hasn't expired. So:
//   - "Sign out" really ends the session server-side, not just in this
//     browser: a copied cookie stops working too.
//   - "Sign out everywhere" revokes every admin session at once (lost
//     laptop, shared computer).
//   - Changing ADMIN_SESSION_SECRET in Vercel signs everyone out.
// Sessions last 4 hours (SESSION_MAX_AGE_SECONDS below).
//
// This is still NOT real per-user auth: there's no admin user record and
// no per-admin audit trail, and the password is a single shared secret.
// That trade-off is fine while it's just Hassan adding contractors by
// hand. The moment a second person needs admin access, or you want to know
// *who* verified a given contractor, replace this with an admin user table
// (task sheet I, "Real per-admin accounts").

import { cookies, headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  ADMIN_COOKIE_NAME,
  createAdminToken,
  newAdminSessionId,
  readAdminToken,
} from '@/lib/admin-token';

// 4 hours, admin only (developer and contractor sessions use NextAuth in
// auth.ts and are unaffected). Deliberately short: this account can
// verify contractors, alert PRO leads and see every developer's contact
// details, so it's worth re-entering password + 2FA more often.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 4;

/**
 * Full check: signature, expiry, and the AdminSession row. Shared by
 * isAdminAuthenticated() and the /admin page gate in proxy.ts.
 */
export async function isAdminTokenActive(token: string | undefined): Promise<boolean> {
  const sessionId = readAdminToken(token);
  if (!sessionId) return false;

  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
    select: { expiresAt: true, revokedAt: true },
  });
  return !!session && !session.revokedAt && session.expiresAt > new Date();
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return isAdminTokenActive(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export async function setAdminSession() {
  const id = newAdminSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  // Recorded so a future "active sessions" list can say where a login came
  // from. Trimmed: these are request headers, i.e. attacker-controlled.
  const h = await headers();
  const ip = (h.get('x-vercel-forwarded-for') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for') ?? '')
    .split(',')[0]
    .trim()
    .slice(0, 100);
  const userAgent = (h.get('user-agent') ?? '').slice(0, 300);

  await prisma.adminSession.create({
    data: { id, expiresAt, ip: ip || null, userAgent: userAgent || null },
  });

  // Housekeeping: rows past their expiry are useless. Cheap, and runs only
  // on login, so the table never grows past a handful of rows.
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createAdminToken(id, expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

/**
 * Ends this browser's admin session (revokes its row and deletes the
 * cookie). With `everywhere`, revokes every admin session that is still
 * open, on any device.
 */
export async function clearAdminSession({ everywhere = false }: { everywhere?: boolean } = {}) {
  const cookieStore = await cookies();
  const sessionId = readAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  const now = new Date();

  if (everywhere) {
    await prisma.adminSession.updateMany({ where: { revokedAt: null }, data: { revokedAt: now } });
  } else if (sessionId) {
    await prisma.adminSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  cookieStore.delete(ADMIN_COOKIE_NAME);
}
