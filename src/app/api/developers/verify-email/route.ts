// src/app/api/developers/verify-email/route.ts
//
// Consumes a one-time verification token sent by sendVerificationEmail.
// Marks the account verified and clears the token so it can't be reused.
// Expired or unknown tokens get the same generic error — no need to
// distinguish "expired" from "never existed" for the person clicking it.

import { syncDeveloperToOps } from '@/lib/ops-sync';
import { after, NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNewSignupAdminEmail } from '@/lib/email';
import { sendAdminPush } from '@/lib/push';
import { SITE_URL } from '@/lib/site';

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

  // Only the request that actually uses up the token goes on, so two
  // clicks at the same moment can't send the team two alerts.
  const used = await prisma.developer.updateMany({
    where: { id: developer.id, emailVerifyToken: token },
    data: {
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyTokenExpiresAt: null,
    },
  });
  if (used.count === 0) return NextResponse.json({ ok: true });

  // Announced to the Operations app only now that the email is proven.
  syncDeveloperToOps(developer.id, 'developer.signed_up');
  // And to the team's inboxes, after the response so the visitor never waits.
  after(() =>
    sendNewSignupAdminEmail({
      kind: 'developer',
      name: developer.name,
      adminUrl: `${SITE_URL}/admin/developers`,
    })
  );
  after(() =>
    sendAdminPush({
      title: 'New developer sign-up',
      body: developer.name,
      url: '/admin/developers',
      tag: `admin-developer-${developer.id}`,
    })
  );
  return NextResponse.json({ ok: true });
}
