// src/app/api/contractors/forgot-password/route.ts
//
// Mirrors src/app/api/developers/forgot-password/route.ts exactly, against
// the Contractor table instead. Same generic-response reasoning applies.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

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
  const contractor = await prisma.contractor.findUnique({ where: { email: normalizedEmail } });

  // Only send a reset link if this contractor already has a password set —
  // an admin-placeholder row with no passwordHash yet should go through
  // signup (to claim the account), not password reset.
  if (contractor?.passwordHash) {
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.contractor.update({
      where: { id: contractor.id },
      data: { passwordResetToken, passwordResetTokenExpiresAt },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? '';
    await sendPasswordResetEmail({
      toEmail: contractor.email,
      toName: contractor.name,
      resetUrl: `${baseUrl}/reset-password?token=${passwordResetToken}&role=contractor`,
    });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
