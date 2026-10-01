// src/app/api/developers/resend-verification/route.ts
//
// POST: issues a fresh email-verification link to the signed-in developer.
// Needed now that quote requests and project posts require a verified
// email. Without it, someone whose original link expired (24h) or got lost
// in spam would be stuck with no way forward.
//
// Signed-in only, and always to the address already on the account, never
// one supplied in the request, so this can't be used to send email to
// arbitrary addresses. Rate limited because every call sends an email.
// A new token replaces the old one, so only the most recent link works.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/email';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  if (!(await checkRateLimit(`resend-verification:${session.user.id}`, { maxAttempts: 3, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json(
      { error: 'We already sent a few links recently. Check your inbox and spam folder, or try again in an hour.' },
      { status: 429 }
    );
  }

  const developer = await prisma.developer.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, emailVerified: true },
  });
  if (!developer) {
    return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  }
  if (developer.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const emailVerifyToken = crypto.randomBytes(32).toString('hex');
  await prisma.developer.update({
    where: { id: developer.id },
    data: {
      emailVerifyToken,
      emailVerifyTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h, same as signup
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  const sent = await sendVerificationEmail({
    toEmail: developer.email,
    toName: developer.name,
    verifyUrl: `${baseUrl}/verify-email?token=${emailVerifyToken}`,
  });

  if (!sent) {
    return NextResponse.json(
      { error: "We couldn't send the email just now. Please try again in a few minutes." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
