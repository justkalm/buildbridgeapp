// src/app/api/admin/login/route.ts
//
// Checks the submitted password against ADMIN_PASSWORD and sets the admin
// session cookie if it matches. See src/lib/admin-auth.ts for why this is
// a shared-password stopgap rather than real per-user auth.
//
// Two things hardened here beyond the basic check:
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

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { setAdminSession } from '@/lib/admin-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

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

  if (!process.env.ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD is not set in the environment');
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 });
  }

  if (!password || !constantTimeEquals(password, process.env.ADMIN_PASSWORD)) {
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
