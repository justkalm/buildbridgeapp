// src/app/api/developers/verify-email/route.ts
//
// Consumes a one-time verification token sent by sendVerificationEmail.
// Marks the account verified and clears the token so it can't be reused.
// Expired or unknown tokens get the same generic error — no need to
// distinguish "expired" from "never existed" for the person clicking it.

import { syncDeveloperToOps } from '@/lib/ops-sync';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const token = (body as { token?: unknown })?.token;
  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ error: 'Missing verification token' }, { status: 400 });
  }

  const developer = await prisma.developer.findUnique({
    where: { emailVerifyToken: token },
  });

  if (
    !developer ||
    !developer.emailVerifyTokenExpiresAt ||
    developer.emailVerifyTokenExpiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: 'This verification link is invalid or has expired.' },
      { status: 400 }
    );
  }

  await prisma.developer.update({
    where: { id: developer.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyTokenExpiresAt: null,
    },
  });

  // Announced to the Operations app only now that the email is proven.
  syncDeveloperToOps(developer.id, 'developer.signed_up');
  return NextResponse.json({ ok: true });
}
