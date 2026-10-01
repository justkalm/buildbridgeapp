// src/app/api/developers/me/route.ts
//
// GET: the signed-in developer's own account basics, for the dashboard.
// Right now that's just enough to show the "verify your email" banner,
// since quote requests and project posts are blocked until the email is
// verified. Explicit `select` on purpose: never return passwordHash or the
// token fields.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isEmailVerificationRequired } from '@/lib/require-verified-email';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const developer = await prisma.developer.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, emailVerified: true, phone: true }, // phone pre-fills quote forms
  });
  if (!developer) {
    return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  }

  // verificationRequired tells the dashboard whether to show the "verify
  // your email" banner at all. While the switch is off (see
  // src/lib/require-verified-email.ts) the banner would nag about a rule
  // that isn't being enforced, and offer a resend that can't reach them.
  return NextResponse.json({ ...developer, verificationRequired: isEmailVerificationRequired() });
}
