// src/app/api/developers/reset-password/route.ts
//
// Consumes a one-time reset token and sets a new password. Token is
// cleared after use (or on expiry check failure) so it can't be replayed.
//
// New password must pass src/lib/password-policy.ts (same rules as
// signup). A successful reset also marks the email verified — see the
// comment on the update below for why.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { newPasswordSchema, passwordMatchesEmail, EMAIL_PASSWORD_MESSAGE } from '@/lib/password-policy';

const schema = z.object({
  token: z.string().min(1),
  password: newPasswordSchema,
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  const developer = await prisma.developer.findUnique({
    where: { passwordResetToken: token },
  });

  if (
    !developer ||
    !developer.passwordResetTokenExpiresAt ||
    developer.passwordResetTokenExpiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired.' },
      { status: 400 }
    );
  }

  // The email isn't in the request body here, so the "not your own
  // email" half of the policy is checked against the row instead. Done
  // after the token check so an invalid token never gets a hint about
  // whose account it was.
  if (passwordMatchesEmail(password, developer.email)) {
    return NextResponse.json({ error: EMAIL_PASSWORD_MESSAGE }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.developer.update({
    where: { id: developer.id },
    data: {
      passwordHash,
      // Signs this account out on every other device (see the jwt
      // callback in src/lib/auth.ts). The person resetting isn't signed in
      // here; they log in fresh with the new password afterwards.
      sessionVersion: { increment: 1 },
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
      // Using a reset link proves inbox ownership just as well as the
      // verify-email link does — the token was only ever sent to this
      // address. So mark the email verified and retire any outstanding
      // verify token (it's now redundant, and leaving it live just leaves
      // one more valid secret sitting in an old email). This also gets
      // someone who lost the original verification email unstuck from the
      // actions that require a verified email, without a separate resend.
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
