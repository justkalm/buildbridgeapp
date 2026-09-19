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
import { computeLeadVisibility, getMonthStart, LISTED_MONTHLY_LEAD_CAP } from '@/lib/lead-limits';
import { isValidTradeType } from '@/lib/trade-types';

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
      // Alerts admin has manually sent this contractor about posted
      // projects — see ProjectPostAlert schema comment. This is correct
      // TODAY only because a LISTED contractor can never have any rows
      // here — enforced entirely at alert-send time, in a different file
      // (admin/project-posts/[id]/alert/route.ts). That split is exactly
      // the kind of thing that breaks later: if the write-side rule ever
      // changes or has a bug, this read route would start leaking full
      // contact details to LISTED contractors with no defense of its own.
      // The filter below is that defense — belt and suspenders, not
      // trusting the other file's enforcement alone.
      projectAlerts: {
        orderBy: { alertedAt: 'desc' },
        take: 50,
        include: {
          projectPost: {
            select: {
              projectType: true,
              location: true,
              budgetRangeLabel: true,
              details: true,
              contactPhone: true,
              developer: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!contractor) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Lead-limit enforcement — LISTED contractors get LISTED_MONTHLY_LEAD_CAP
  // fully-visible quote requests per calendar month; the rest are blurred.
  // See src/lib/lead-limits.ts for the full reasoning. This has to happen
  // server-side, not just hidden in the UI: stripping developer.email/
  // phone/name out of the actual response is what stops a contractor from
  // just reading the network tab to see contact info they haven't paid
  // for. A CSS blur alone would be purely cosmetic.
  const monthStart = getMonthStart();
  const thisMonthRequests = contractor.quoteRequests
    .filter((r) => r.createdAt >= monthStart)
    // oldest-first for the cap calculation — see lead-limits.ts on why
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const visibilityById = computeLeadVisibility(contractor.tier, thisMonthRequests);

  const quoteRequestsWithVisibility = contractor.quoteRequests.map((r) => {
    // Requests from a PRIOR month are never blurred — the cap is scoped to
    // the current month only, so history already visible stays visible.
    const visibility = visibilityById.get(r.id) ?? 'full';

    if (visibility === 'full') {
      return { ...r, leadVisibility: 'full' as const };
    }

    // Blurred: strip contactPhone entirely and truncate details, not just
    // the developer object. Previously `...rest` kept every other field
    // on the QuoteRequest — including contactPhone (the developer's own
    // phone number, captured at request time even before any contractor
    // relationship exists) and the full, untruncated details text, which
    // frequently contains a site address or a second number. A LISTED
    // contractor at their cap could open devtools, read this response
    // directly, and get full contact information for a "blurred" lead —
    // the blur was cosmetic on the frontend while the real data still
    // shipped in the JSON. Stripping it here, not just hiding it in the
    // UI, is what actually enforces the cap.
    const { developer, contactPhone: _contactPhone, details, ...rest } = r;
    return {
      ...rest,
      details: details.length > 80 ? `${details.slice(0, 80)}…` : details,
      contactPhone: null,
      developer: { name: developer.name, email: null, phone: null },
      leadVisibility: 'blurred' as const,
    };
  });

  // Never return passwordHash or reset/verify tokens to the client.
  const {
    passwordHash: _passwordHash,
    emailVerifyToken: _evt,
    passwordResetToken: _prt,
    quoteRequests: _rawQuoteRequests,
    projectAlerts: rawProjectAlerts,
    ...safe
  } = contractor;

  // Defensive strip, independent of the write-time PLUS/PRO enforcement —
  // see the comment on the projectAlerts select above for why this
  // exists as its own check rather than trusting that the other file
  // never lets a LISTED contractor accumulate alert rows.
  const projectAlerts =
    contractor.tier === 'LISTED'
      ? []
      : rawProjectAlerts;

  return NextResponse.json({
    ...safe,
    quoteRequests: quoteRequestsWithVisibility,
    projectAlerts,
    leadLimit:
      contractor.tier === 'LISTED'
        ? { cap: LISTED_MONTHLY_LEAD_CAP, usedThisMonth: thisMonthRequests.length }
        : null,
  });
}

// Profile fields that trigger a re-verification reset when changed.
const profileSchema = z.object({
  bio: z.string().trim().max(2000).optional(),
  city: z.string().trim().min(1).max(100).optional(),
  area: z.string().trim().min(1).max(100).optional(),
  tradeTypes: z
    .array(z.string().trim().min(1))
    .max(10)
    .refine((types) => types.every(isValidTradeType), {
      message: 'One or more trade types are not in the allowed list',
    })
    .optional(),
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
