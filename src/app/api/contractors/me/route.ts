// src/app/api/contractors/me/route.ts
//
// Self-service endpoint for a logged-in contractor. GET returns their own
// record plus projects and quote requests. PATCH updates editable profile
// fields.
//
// IMPORTANT: any PATCH that changes profile content resets
// verificationStatus back to PENDING and clears verifiedAt. Verification
// means you (admin) checked the license number and the details attached to
// it — if a contractor can silently edit their bio, trade types, or
// license number after being verified, "Verified" stops meaning anything.
// The one exception is the consent-only PATCH (see PATCH_CONSENT_FIELDS
// below), which doesn't touch anything admin verified and so doesn't
// reset status.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireContractor() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'contractor') {
    return null;
  }
  return session.user.id as string;
}

export async function GET() {
  const contractorId = await requireContractor();
  if (!contractorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    include: {
      projects: { orderBy: { createdAt: 'desc' } },
      // Previously omitted `developer` entirely here, while the dashboard
      // page reads `r.developer.name` on every quote request row — any
      // contractor with at least one real quote request crashed the whole
      // dashboard on load. Also including email/phone now, not just name:
      // the point of a contractor seeing their quote requests at all is so
      // they can reach out directly, not just see that someone asked.
      quoteRequests: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          developer: { select: { name: true, email: true, phone: true } },
        },
      },
    },
  });

  if (!contractor) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Never return passwordHash or reset/verify tokens to the client.
  const {
    passwordHash: _passwordHash,
    emailVerifyToken: _evt,
    passwordResetToken: _prt,
    ...safe
  } = contractor;

  return NextResponse.json(safe);
}

// Profile fields that trigger a re-verification reset when changed.
const profileSchema = z.object({
  bio: z.string().trim().max(2000).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  area: z.string().trim().min(1).max(100).optional(),
  tradeTypes: z.array(z.string().trim().min(1)).max(10).optional(),
  yearsInBusiness: z.number().int().min(0).max(100).nullable().optional(),
  teamSizeMin: z.number().int().min(0).max(10000).nullable().optional(),
  teamSizeMax: z.number().int().min(0).max(10000).nullable().optional(),
  gstRegistered: z.boolean().optional(),
  insuranceCoverLakh: z.number().int().min(0).nullable().optional(),
  phone: z.string().trim().min(7).max(20).optional(),
});

export async function PATCH(req: Request) {
  const contractorId = await requireContractor();
  if (!contractorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const updated = await prisma.contractor.update({
    where: { id: contractorId },
    data: {
      ...parsed.data,
      // Any profile edit resets verification — see file header comment.
      verificationStatus: 'PENDING',
      verifiedAt: null,
    },
  });

  const {
    passwordHash: _passwordHash,
    emailVerifyToken: _evt,
    passwordResetToken: _prt,
    ...safe
  } = updated;

  return NextResponse.json(safe);
}
