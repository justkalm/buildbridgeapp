// src/app/api/admin/login/route.ts
//
// Checks the submitted password AND a 6-digit TOTP code against
// ADMIN_PASSWORD / ADMIN_TOTP_SECRET, setting the admin session cookie
// only if both match. See src/lib/admin-auth.ts for why this is a
// shared-password stopgap rather than real per-user auth, and
// src/lib/admin-totp.ts for the same reasoning applied to the 2FA secret.
//
// Password is checked BEFORE the TOTP code, and a wrong password never
// reveals whether 2FA would have passed — the response is the same
// generic "Incorrect password" whether the password was wrong or the code
// was wrong, once the password check fails, so a partial correct guess
// can't be distinguished from a totally wrong one.
//
// Three things hardened here beyond the basic check:
// - Rate limiting (see src/lib/rate-limit.ts for its real scope/limits)
//   caps how many login attempts one IP can make per window, so this
//   endpoint can't be hammered for free even though the password itself
//   is already too long to brute-force in practice.
// - Constant-time comparison instead of `!==` on the password strings.
//   A naive comparison returns as soon as it finds a mismatched
//   character, so response time subtly correlates with how many leading
//   characters were guessed correctly — in theory lets an attacker infer
//   the password byte-by-byte from timing alone. crypto.timingSafeEqual
//   always takes the same time regardless of where the mismatch is.
// - The TOTP code itself, verified only after the password passes.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { setAdminSession } from '@/lib/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { verifyAdminTotp } from '@/lib/admin-totp';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const allowed = checkRateLimit(`admin-login:${ip}`, {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  });

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const password = (body as { password?: string })?.password;
  const totpCode = (body as { totpCode?: string })?.totpCode;

  if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not set in the environment');
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 });
  }

  if (!process.env.ADMIN_TOTP_SECRET) {
    console.error('ADMIN_TOTP_SECRET is not set in the environment');
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 });
  }

  if (!password || !constantTimeEquals(password, process.env.ADMIN_PASSWORD)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  if (!totpCode || !verifyAdminTotp(totpCode)) {
    // Deliberately the SAME status/shape of error as a wrong password —
    // see file header comment on why this isn't more specific.
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  await setAdminSession();
  return NextResponse.json({ ok: true });
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  // Different-length inputs must be checked before timingSafeEqual, which
  // throws on mismatched buffer lengths rather than returning false. This
  // length check itself technically leaks length via timing, but password
  // length isn't secret the way its content is, so that's an acceptable
  // trade.
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}
