// src/app/api/developers/forgot-password/route.ts
//
// Requests a password reset. Always returns the same generic success
// response whether or not the email is actually registered — this is
// deliberate, same reasoning as the signup route's duplicate-email
// handling: returning "no account with that email" here would let anyone
// probe which emails have accounts.
//
// Rate limited by the TARGET EMAIL, not just IP. IP-only limiting is weak
// here specifically: the actual harm is spam-bombing one person's inbox
// with reset emails, which an attacker can do from many different IPs (a
// botnet, a VPN, a simple retry loop) all aimed at the same address. Keying
// the limit on the email itself protects the victim regardless of where
// the requests originate. Deliberately generous (3/hour) since it's rare
// for someone to legitimately need more than a couple reset attempts.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().trim().email().max(320),
});

const GENERIC_RESPONSE = {
  message: 'If an account exists with that email, a reset link has been sent.',
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  // Checked (and consumes a slot) even when the email doesn't match an
  // account, and the response is identical either way — otherwise an
  // attacker could distinguish "real account, rate-limited" from "no such
  // account" by which response they get.
  if (!checkRateLimit(`developer-forgot-password:${normalizedEmail}`, { maxAttempts: 3, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  const developer = await prisma.developer.findUnique({ where: { email: normalizedEmail } });

  if (developer) {
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.developer.update({
      where: { id: developer.id },
      data: { passwordResetToken, passwordResetTokenExpiresAt },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? '';
    await sendPasswordResetEmail({
      toEmail: developer.email,
      toName: developer.name,
      resetUrl: `${baseUrl}/reset-password?token=${passwordResetToken}`,
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
