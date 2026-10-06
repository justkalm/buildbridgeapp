// src/app/api/contractors/me/route.ts
//
// Self-service endpoint for a logged-in contractor. GET returns their own
// record plus projects and quote requests. PATCH updates editable profile
// fields.
//
// IMPORTANT (see CREDENTIAL_FIELDS below): editing NEVER takes a listing
// offline (the owner's rule). When a VERIFIED contractor actually CHANGES
// one of the "credential" fields, the ones tied to what admin checked
// during verification (document review, GSTIN check, a direct phone or
// in-person conversation; see the homepage's verification section), they
// stay VERIFIED and listed, but the contractor is flagged reverifyPending
// with the changed fields recorded, the public badge reads "Verified ·
// update in review", and admin is emailed to re-check. Admin then confirms
// (clears the flag) or downgrades them from Admin > Contractors.
// Editing a purely cosmetic field (bio, team size, years in business,
// insurance cover) doesn't flag anything: nothing in those fields is
// something the badge claims was checked.
//
// GET also drives in-app notifications: quote requests and project alerts
// the contractor hasn't seen yet come back with isNew: true and are then
// marked seen (loading the dashboard is what "seeing" means), so the Nav
// badge (via /api/messages/unread) clears.
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

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyLeadVisibility, getMonthStart, LISTED_MONTHLY_LEAD_CAP } from '@/lib/lead-limits';
import { monthLeadsFor } from '@/lib/month-leads';
import { sendReverifyRequestEmail } from '@/lib/email';
import { normalizeLocation } from '@/lib/location';
import { insuranceCoverLakhField, teamSizeField, teamSizeRangeError, tradeTypesField } from '@/lib/project-validation';

// The ONLY contractor columns this endpoint ever returns, for both GET and
// PATCH. An explicit select (instead of returning the whole row) means a
// column added to the schema later, such as another token or an internal
// counter, can never leak to the browser by accident. Each field is here
// because a page reads it:
//   - dashboard: id, name, verificationStatus, tier, emailVerified
//   - profile edit form (and its credential-change check): name, bio, city,
//     area, tradeTypes, yearsInBusiness, teamSizeMin/Max, gstRegistered,
//     insuranceCoverLakh, phone, verificationStatus
//   - consent page: dataSharingConsent, dataSharingConsentAt
// Deliberately NOT here: passwordHash, email*/passwordReset* tokens and
// expiries, sessionVersion, reverify internals, licenseNumber, slug, email.
const CONTRACTOR_SELF_SELECT = {
  id: true,
  name: true,
  bio: true,
  city: true,
  area: true,
  tradeTypes: true,
  yearsInBusiness: true,
  teamSizeMin: true,
  teamSizeMax: true,
  gstRegistered: true,
  insuranceCoverLakh: true,
  phone: true,
  verificationStatus: true,
  tier: true,
  emailVerified: true,
  dataSharingConsent: true,
  dataSharingConsentAt: true,
  // Verification progress shown on the dashboard strip (KALM-211).
  checkDocumentsAt: true,
  checkGstinAt: true,
  checkContactAt: true,
} as const;

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
    select: {
      ...CONTRACTOR_SELF_SELECT,
      // Count only, for the dashboard's profile checklist.
      _count: { select: { projects: true } },
      // Previously omitted `developer` entirely here, while the dashboard
      // page reads `r.developer.name` on every quote request row — any
      // contractor with at least one real quote request crashed the whole
      // dashboard on load. Also including email/phone now, not just name:
      // the point of a contractor seeing their quote requests at all is so
      // they can reach out directly, not just see that someone asked.
      // Explicit fields only (the dashboard's row type); contractorSeenAt
      // and kind are needed here on the server but stripped before sending.
      quoteRequests: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          kind: true,
          projectType: true,
          location: true,
          budgetRangeLabel: true,
          details: true,
          status: true,
          createdAt: true,
          contractorSeenAt: true,
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
        select: {
          id: true,
          alertedAt: true,
          seenAt: true,
          projectPost: {
            select: {
              id: true,
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
  // phone out of the actual response is what stops a contractor from
  // just reading the network tab to see contact info they haven't paid
  // for. A CSS blur alone would be purely cosmetic.
  const monthStart = getMonthStart();
  // EVERY lead of this month (quote requests of any kind and site visit
  // requests), oldest first, ids only. The list sent to the
  // dashboard (contractor.quoteRequests above) is cut to the newest 50, so it
  // cannot be used to decide which five are free: with more than 50 leads in a
  // month, the oldest ones would be missing and the wrong five would show in
  // full. This is the same month-wide query the other cap checks use
  // (src/lib/quote-request-access.ts, create-quote-request.ts).
  const thisMonthRequests = await monthLeadsFor(contractorId, monthStart);

  // Which leads are full and which are blurred (and the stripping of email,
  // phone and long details from blurred ones) is src/lib/lead-limits.ts
  // applyLeadVisibility, which has its own tests.
  const quoteRequestsWithVisibility = applyLeadVisibility(
    contractor.tier,
    monthStart,
    thisMonthRequests,
    contractor.quoteRequests
  );

  // Pull the profile fields out of the row; the quote requests and alerts
  // are rebuilt below with only what the dashboard shows.
  const { quoteRequests: _rawQuoteRequests, projectAlerts: rawProjectAlerts, _count, ...safe } = contractor;

  // In-app notifications (see file header): anything not yet seen is
  // flagged isNew for this response, then marked seen.
  const newQuoteIds = contractor.quoteRequests.filter((r) => !r.contractorSeenAt).map((r) => r.id);
  const newAlertIds = rawProjectAlerts.filter((a) => !a.seenAt).map((a) => a.id);
  if (newQuoteIds.length > 0 || newAlertIds.length > 0) {
    const now = new Date();
    await Promise.all([
      newQuoteIds.length > 0
        ? prisma.quoteRequest.updateMany({ where: { id: { in: newQuoteIds } }, data: { contractorSeenAt: now } })
        : null,
      newAlertIds.length > 0
        ? prisma.projectPostAlert.updateMany({ where: { id: { in: newAlertIds } }, data: { seenAt: now } })
        : null,
    ]);
  }
  const newQuoteSet = new Set(newQuoteIds);

  // Conversations this contractor already started from an alert ("I'm
  // interested"), so each alert can show "Open conversation" instead of
  // offering to start a second one.
  const alertConversations = await prisma.quoteRequest.findMany({
    where: {
      kind: 'PROJECT',
      contractorId,
      projectPostId: { in: rawProjectAlerts.map((a) => a.projectPost.id) },
    },
    select: { id: true, projectPostId: true },
  });
  const conversationByPost = new Map(alertConversations.map((c) => [c.projectPostId, c.id]));
  const newAlertSet = new Set(newAlertIds);

  // Defensive strip, independent of the write-time PLUS/PRO enforcement —
  // see the comment on the projectAlerts select above for why this
  // exists as its own check rather than trusting that the other file
  // never lets a LISTED contractor accumulate alert rows.
  const projectAlerts =
    contractor.tier === 'LISTED'
      ? []
      : rawProjectAlerts.map(({ seenAt: _seenAt, ...a }) => ({
          ...a,
          isNew: newAlertSet.has(a.id),
          conversationId: conversationByPost.get(a.projectPost.id) ?? null,
        }));

  return NextResponse.json({
    ...safe,
    projectCount: _count.projects,
    // Only real quote requests are listed on the dashboard; enquiries and
    // project conversations live in Messages. (They still counted toward
    // the lead cap above, since every kind is a lead.)
    quoteRequests: quoteRequestsWithVisibility
      .filter((r) => r.kind === 'QUOTE')
      // contractorSeenAt and kind are server-side bookkeeping only.
      .map(({ contractorSeenAt: _seen, kind: _kind, ...r }) => ({ ...r, isNew: newQuoteSet.has(r.id) })),
    projectAlerts,
    leadLimit:
      contractor.tier === 'LISTED'
        ? { cap: LISTED_MONTHLY_LEAD_CAP, usedThisMonth: Math.min(thisMonthRequests.length, LISTED_MONTHLY_LEAD_CAP) }
        : null,
  });
}

// Fields whose CHANGE (not merely presence in the request body) resets
// verification — see the file header for why each one is here. Kept as an
// explicit list (rather than e.g. "everything except bio") so it's an
// intentional decision per field, not a default that silently expands as
// the schema grows.
const CREDENTIAL_FIELDS = ['city', 'area', 'phone', 'gstRegistered', 'tradeTypes'] as const;

// How each credential field is named to admin in the re-check email and
// the Admin > Contractors flag.
const CREDENTIAL_FIELD_LABELS: Record<(typeof CREDENTIAL_FIELDS)[number], string> = {
  city: 'City',
  area: 'Area',
  phone: 'Phone',
  gstRegistered: 'GST registration',
  tradeTypes: 'Trades',
};

const profileSchema = z.object({
  bio: z.string().trim().max(2000).optional(),
  // Normalized to consistent capitalisation — see src/lib/location.ts.
  city: z.string().trim().min(1).max(100).transform(normalizeLocation).optional(),
  area: z.string().trim().min(1).max(100).transform(normalizeLocation).optional(),
  tradeTypes: tradeTypesField().optional(),
  yearsInBusiness: z.number().int().min(0).max(100).nullable().optional(),
  // 'from' <= 'to' is checked in PATCH, where the stored value is available
  // for partial updates. Insurance cap: see MAX_INSURANCE_COVER_LAKH.
  teamSizeMin: teamSizeField('Team size').nullable().optional(),
  teamSizeMax: teamSizeField('Team size').nullable().optional(),
  gstRegistered: z.boolean().optional(),
  insuranceCoverLakh: insuranceCoverLakhField().nullable().optional(),
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
    select: {
      name: true,
      city: true,
      area: true,
      phone: true,
      gstRegistered: true,
      tradeTypes: true,
      teamSizeMin: true,
      teamSizeMax: true,
      verificationStatus: true,
      reverifyFields: true,
    },
  });
  if (!current) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Team size 'from' must not exceed 'to'. For a partial PATCH (only one of
  // the two sent) compare against the stored value of the other; an explicit
  // null clears that side and so can't conflict.
  const nextMin = 'teamSizeMin' in parsed.data ? parsed.data.teamSizeMin : current.teamSizeMin;
  const nextMax = 'teamSizeMax' in parsed.data ? parsed.data.teamSizeMax : current.teamSizeMax;
  const rangeError = teamSizeRangeError(nextMin, nextMax);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  const changedCredentials = CREDENTIAL_FIELDS.filter((field) => {
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

  const flagForReverify = changedCredentials.length > 0 && current.verificationStatus === 'VERIFIED';

  const updated = await prisma.contractor.update({
    where: { id: contractorId },
    data: {
      ...parsed.data,
      // A Verified contractor changing a checked detail stays Verified
      // and listed, flagged for admin to re-check (see the file header).
      // Fields already awaiting a re-check are kept, so admin sees
      // everything that changed since the last confirmation. A PENDING or
      // REJECTED contractor is already waiting on admin, so there's
      // nothing extra to flag.
      ...(flagForReverify
        ? {
            reverifyPending: true,
            reverifyRequestedAt: new Date(),
            reverifyFields: [...new Set([...current.reverifyFields, ...changedCredentials])],
          }
        : {}),
    },
    // Same explicit field list as GET, so the profile page can drop the
    // response straight into its state without ever seeing hashes/tokens.
    select: CONTRACTOR_SELF_SELECT,
  });

  if (flagForReverify) {
    const baseUrl = process.env.NEXTAUTH_URL ?? '';
    after(() =>
      sendReverifyRequestEmail({
        contractorName: current.name,
        changedFields: changedCredentials.map((f) => CREDENTIAL_FIELD_LABELS[f]),
        adminUrl: `${baseUrl}/admin/contractors`,
      })
    );
  }

  return NextResponse.json(updated);
}
