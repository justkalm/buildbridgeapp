// src/app/api/contractors/me/route.ts
//
// Self-service endpoint for a logged-in contractor. GET returns their own
// record plus projects and quote requests. PATCH updates editable profile
// fields.
//
// IMPORTANT (updated, see CREDENTIAL_FIELDS below): a PATCH only resets
// verificationStatus back to PENDING and clears verifiedAt when it
// actually CHANGES one of the "credential" fields, the ones tied to what
// admin actually checked during verification (see the three checks listed
// on the homepage's verification section: document review, GSTIN check,
// and a direct phone/in-person conversation). Editing a purely cosmetic
// field (bio, team size, years in business, insurance cover) no longer
// knocks a Verified contractor back to Pending. There is nothing in those
// fields that the badge claims was checked, so there's nothing for a
// change to invalidate.
//
// CREDENTIAL_FIELDS and why each one is here:
//   - city / area:    the in-person/phone conversation is tied to where
//                      the business operates, so relocating changes what
//                      would need re-confirming.
//   - phone:           this is the number admin actually rang as part of
//                      verification (see check (c)); changing it means
//                      the verified conversation no longer maps to the
//                      current contact.
//   - gstRegistered:   directly tied to check (b), the GSTIN lookup on the
//                      GST portal. Flipping this claim invalidates that
//                      check outright.
//   - tradeTypes:      the license, GST, and registration documents admin
//                      reviewed (check (a)) only cover the trades on file
//                      at verification time. Adding a trade the checked
//                      documents may not actually cover would let a
//                      contractor borrow the Verified badge for unrelated
//                      work.
// Anything else editable here (bio, yearsInBusiness, teamSizeMin/Max,
// insuranceCoverLakh) is cosmetic: none of the three verification checks
// touch these values, so changing them doesn't retroactively invalidate
// anything the badge claims. (name/business name and licenseNumber aren't
// editable through this route at all today — if that ever changes, they
// belong in CREDENTIAL_FIELDS too.)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeLeadVisibility, getMonthStart, LISTED_MONTHLY_LEAD_CAP } from '@/lib/lead-limits';
import { isValidTradeType } from '@/lib/trade-types';
import { normalizeLocation } from '@/lib/location';

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

// Fields whose CHANGE (not merely presence in the request body) resets
// verification — see the file header for why each one is here. Kept as an
// explicit list (rather than e.g. "everything except bio") so it's an
// intentional decision per field, not a default that silently expands as
// the schema grows.
const CREDENTIAL_FIELDS = ['city', 'area', 'phone', 'gstRegistered', 'tradeTypes'] as const;

const profileSchema = z.object({
  bio: z.string().trim().max(2000).optional(),
  // Normalized to consistent capitalisation — see src/lib/location.ts.
  city: z.string().trim().min(1).max(100).transform(normalizeLocation).optional(),
  area: z.string().trim().min(1).max(100).transform(normalizeLocation).optional(),
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

function valuesDiffer(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.some((v, i) => v !== sortedB[i]);
  }
  return a !== b;
}

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

  // Only reset verification if a CREDENTIAL field is actually changing —
  // comparing against the current row, not just "was it in the request
  // body", since the profile page always submits the full form (every
  // field present) even when only a cosmetic field like bio was edited.
  // Without this diff, every save would look like a credential edit again.
  const current = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { city: true, area: true, phone: true, gstRegistered: true, tradeTypes: true },
  });
  if (!current) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const credentialChanged = CREDENTIAL_FIELDS.some((field) => {
    if (!(field in parsed.data)) return false;
    const incoming = parsed.data[field as keyof typeof parsed.data];
    let existing = current[field as keyof typeof current];
    // Compare locations in normalized form on both sides, so a row saved
    // as "thane" before capitalisation was enforced doesn't count as a
    // credential change (and cost a Verified badge) the first time it's
    // re-saved as "Thane".
    if ((field === 'city' || field === 'area') && typeof existing === 'string') {
      existing = normalizeLocation(existing);
    }
    return valuesDiffer(incoming, existing);
  });

  const updated = await prisma.contractor.update({
    where: { id: contractorId },
    data: {
      ...parsed.data,
      // Reset verification only when a credential field changed — see
      // CREDENTIAL_FIELDS and the file header for the reasoning. A
      // cosmetic-only save (bio, team size, years in business, insurance
      // cover) leaves an existing Verified status untouched.
      ...(credentialChanged ? { verificationStatus: 'PENDING', verifiedAt: null } : {}),
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
