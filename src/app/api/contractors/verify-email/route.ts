// src/app/api/contractors/verify-email/route.ts
//
// Mirrors src/app/api/developers/verify-email/route.ts exactly, against
// the Contractor table instead.

import { syncContractorToOps } from '@/lib/ops-sync';
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

  const contractor = await prisma.contractor.findUnique({
    where: { emailVerifyToken: token },
  });

  if (
    !contractor ||
    !contractor.emailVerifyTokenExpiresAt ||
    contractor.emailVerifyTokenExpiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: 'This verification link is invalid or has expired.' },
      { status: 400 }
    );
  }

  await prisma.contractor.update({
    where: { id: contractor.id },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyTokenExpiresAt: null,
    },
  });

  // Announced to the Operations app only now that the email is proven.
  syncContractorToOps(contractor.id, 'contractor.signed_up');
  return NextResponse.json({ ok: true });
}
