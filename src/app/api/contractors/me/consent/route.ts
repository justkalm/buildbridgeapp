// src/app/api/contractors/me/consent/route.ts
//
// Separate endpoint from /api/contractors/me on purpose: toggling
// data-sharing consent has nothing to do with the listing details admin
// verifies (license, bio, trade types), so it must NOT reset
// verificationStatus the way a profile edit does. Keeping it a distinct
// route makes that guarantee obvious at the file level rather than relying
// on remembering to exclude a field inside a shared handler.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  consent: z.boolean(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'contractor') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const contractor = await prisma.contractor.update({
    where: { id: session.user.id as string },
    data: {
      dataSharingConsent: parsed.data.consent,
      dataSharingConsentAt: parsed.data.consent ? new Date() : null,
    },
    select: { dataSharingConsent: true, dataSharingConsentAt: true },
  });

  return NextResponse.json(contractor);
}
