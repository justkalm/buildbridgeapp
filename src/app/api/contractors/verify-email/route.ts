// src/app/api/contractors/verify-email/route.ts
//
// Mirrors src/app/api/developers/verify-email/route.ts exactly, against
// the Contractor table instead.

import { syncContractorToOps } from '@/lib/ops-sync';
import { after, NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNewSignupAdminEmail } from '@/lib/email';
import { sendAdminPush } from '@/lib/push';
import { isDemoLicense } from '@/lib/license';
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
  // And to the team's inboxes, after the response so the visitor never waits.
  if (!isDemoLicense(contractor.licenseNumber)) {
    after(() =>
      sendNewSignupAdminEmail({
        kind: 'contractor',
        name: contractor.name,
        area: contractor.area,
        adminUrl: `${SITE_URL}/admin/contractors`,
      })
    );
    after(() =>
      sendAdminPush({
        title: 'New contractor sign-up',
        body: contractor.name,
        url: '/admin/contractors',
        tag: `admin-contractor-${contractor.id}`,
      })
    );
  }
  return NextResponse.json({ ok: true });
}
