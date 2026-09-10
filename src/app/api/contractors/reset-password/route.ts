// src/app/api/contractors/reset-password/route.ts
//
// Mirrors src/app/api/developers/reset-password/route.ts exactly, against
// the Contractor table instead.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
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

  const contractor = await prisma.contractor.findUnique({
    where: { passwordResetToken: token },
  });

  if (
    !contractor ||
    !contractor.passwordResetTokenExpiresAt ||
    contractor.passwordResetTokenExpiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired.' },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.contractor.update({
    where: { id: contractor.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
