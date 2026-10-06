// src/app/api/admin/contractors/[id]/route.ts
//
// Single-contractor admin operations: delete one, or update its
// verification status. Gated by the same shared admin password session as
// the rest of /api/admin.
//
// DELETE cascades to that contractor's Projects AND their QuoteRequests —
// see the onDelete: Cascade on both relations in schema.prisma. This means
// deleting a contractor with real quote-request history permanently erases
// that history, not just the contractor's profile. There's no soft delete or
// undo, so the server itself refuses (409) when quote requests, site
// visits or projects exist, until the caller sends the contractor's exact name as
// confirmName (KALM-241). Every delete is also written to the moderation log.

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { ADMIN_SAFE_CONTRACTOR_SELECT } from '@/lib/admin-contractor-select';
import { isPlaceholderLicense } from '@/lib/license';
import { rejectCrossOrigin } from '@/lib/same-origin';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  // Safer deletion (KALM-241 / 124). Deleting a contractor also erases, for
  // good, every quote request and message thread with them, their projects
  // (with any developer reviews), site visits, shortlist entries and project
  // alerts. Developers lose that history too. So when quote requests, site
  // visits or projects exist the server refuses (409, with the counts) and
  // only goes ahead when the caller sends the contractor's exact name back
  // as confirmName. A contractor with none of those deletes as before.
  let confirmName: unknown;
  try {
    confirmName = (await req.json())?.confirmName;
  } catch {
    confirmName = undefined; // no body: the first, unconfirmed attempt
  }
  const normalise = (v: string) => v.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

  // The counts are read AGAIN inside the transaction, right before the
  // delete, so history created while the admin was reading the warning
  // can't be erased unconfirmed and the log note always matches what was
  // really removed. Serializable makes the database refuse (P2034) if
  // something changes underneath. The moderation log row is written in the
  // same transaction, so a delete never goes unrecorded; it holds the
  // contractor's name and counts only, never message text, and it outlives
  // the contractor (targetId has no foreign key).
  class NeedsConfirmation extends Error {
    constructor(public name2: string, public counts: Record<string, number>) {
      super('needs confirmation');
    }
  }
  try {
    const deletedName = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.contractor.findUnique({
          where: { id },
          select: {
            name: true,
            _count: {
              select: { projects: true, quoteRequests: true, siteVisits: true, projectAlerts: true, shortlistedBy: true },
            },
          },
        });
        if (!existing) return null;
        const counts = existing._count;
        const hasHistory = counts.quoteRequests > 0 || counts.siteVisits > 0 || counts.projects > 0;
        const confirmed = typeof confirmName === 'string' && normalise(confirmName) === normalise(existing.name);
        if (hasHistory && !confirmed) {
          const messages = await tx.message.count({ where: { quoteRequest: { contractorId: id } } });
          throw new NeedsConfirmation(existing.name, { ...counts, messages });
        }
        await tx.moderationLog.create({
          data: {
            action: 'contractor_deleted',
            targetType: 'CONTRACTOR',
            targetId: id,
            note: `Deleted "${existing.name}". Removed ${counts.projects} project(s), ${counts.quoteRequests} quote request(s), ${counts.siteVisits} site visit(s), ${counts.projectAlerts} project alert(s), ${counts.shortlistedBy} shortlist entr${counts.shortlistedBy === 1 ? 'y' : 'ies'}.`,
          },
        });
        await tx.contractor.delete({ where: { id } });
        return existing.name;
      },
      { isolationLevel: 'Serializable' }
    );
    if (deletedName === null) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deletedName });
  } catch (err) {
    if (err instanceof NeedsConfirmation) {
      return NextResponse.json(
        {
          error: `${err.name2} has history that would be erased for good. Type their exact name to confirm.`,
          requiresConfirmation: true,
          counts: err.counts,
        },
        { status: 409 }
      );
    }
    const code = (err as { code?: string })?.code;
    // P2025: already deleted (double click, second tab). P2034: the data
    // changed underneath the transaction; nothing was deleted.
    if (code === 'P2025') return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    if (code === 'P2034') {
      return NextResponse.json({ error: 'Something changed while deleting. Nothing was deleted. Try again.' }, { status: 409 });
    }
    throw err;
  }
}

// PATCH updates a contractor's verification status, tier and/or license
// number. Gated the same way as DELETE above. All fields are optional in
// the request body — existing callers that only send verificationStatus
// keep working unchanged; tier is a manual admin override only, not tied
// to billing (see the zod comment in the create route for why).
//
// licenseNumber is editable here because self-signed-up contractors start
// with a PENDING-* placeholder (src/lib/license.ts) and can't be marked
// Verified until a real one is on file. Without this, admin would have no
// way to ever verify them. Changing the license of an already-Verified
// contractor drops them back to PENDING (unless this same request sets
// VERIFIED), because the badge was earned against the old number.
//
// VERIFIED is also blocked while the contractor's city or area is blank.
// Self-signed-up contractors used to start with an empty location (signup
// now requires one, but older rows may still be blank), and a Verified
// badge on a listing that can't be found by location, or checked against
// where they actually work, isn't worth much. This route doesn't edit
// location; the contractor adds it from their own profile.
//
// verifiedAt is kept in step with the status: stamped when a contractor
// becomes VERIFIED, cleared when they stop being VERIFIED.
const VALID_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
type VerificationStatus = (typeof VALID_STATUSES)[number];
const VALID_TIERS = ['LISTED', 'PLUS', 'PRO'] as const;
type ContractorTier = (typeof VALID_TIERS)[number];
//
// RE-VERIFICATION (owner's rule: editing never takes a listing offline):
// when a Verified contractor changes a checked detail they stay Verified,
// flagged reverifyPending (see src/app/api/contractors/me/route.ts). Admin
// clears the flag by sending { confirmReverification: true } once the new
// details check out (which also re-stamps verifiedAt), or by setting any
// verificationStatus (PENDING/REJECTED if they don't check out; VERIFIED
// counts as a confirmation too). An admin correcting a license number no
// longer drops a Verified contractor to PENDING either: admin made the
// change, so it's already checked, and verifiedAt is re-stamped.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const hasStatus = 'verificationStatus' in body;
  const hasTier = 'tier' in body;
  const hasLicense = 'licenseNumber' in body;
  const confirmReverify = body.confirmReverification === true;
  // Verification progress (KALM-211): { checks: { documents?, gstin?, contact? } }
  // with true = stamp now, false = clear. Informational only; it never
  // changes verificationStatus.
  const hasChecks = body.checks !== null && typeof body.checks === 'object' && !Array.isArray(body.checks);

  // Private note (KALM-239): a string, or null/blank to clear it. Admin eyes
  // only; no public or contractor-facing route ever selects this column.
  const hasNote = 'adminNote' in body;

  if (!hasStatus && !hasTier && !hasLicense && !confirmReverify && !hasChecks && !hasNote) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  let newNote: string | null | undefined;
  if (hasNote) {
    if (body.adminNote !== null && typeof body.adminNote !== 'string') {
      return NextResponse.json({ error: 'Note must be text' }, { status: 400 });
    }
    const trimmed = typeof body.adminNote === 'string' ? body.adminNote.trim() : '';
    if (trimmed.length > 2000) {
      return NextResponse.json({ error: 'Note must be 2000 characters or fewer' }, { status: 400 });
    }
    newNote = trimmed || null;
  }

  if (hasStatus && !VALID_STATUSES.includes(body.verificationStatus)) {
    return NextResponse.json({ error: 'Invalid verification status' }, { status: 400 });
  }

  if (hasTier && !VALID_TIERS.includes(body.tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  let newLicense: string | undefined;
  if (hasLicense) {
    newLicense = typeof body.licenseNumber === 'string' ? body.licenseNumber.trim() : '';
    if (!newLicense || newLicense.length > 100) {
      return NextResponse.json({ error: 'License number must be between 1 and 100 characters' }, { status: 400 });
    }
    if (isPlaceholderLicense(newLicense)) {
      return NextResponse.json({ error: 'Enter the real license number, not a placeholder' }, { status: 400 });
    }
  }

  const existing = await prisma.contractor.findUnique({
    where: { id },
    select: {
      id: true,
      licenseNumber: true,
      verificationStatus: true,
      city: true,
      area: true,
      checkDocumentsAt: true,
      checkGstinAt: true,
      checkContactAt: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  const licenseChanging = newLicense !== undefined && newLicense !== existing.licenseNumber;
  if (licenseChanging) {
    const clash = await prisma.contractor.findUnique({
      where: { licenseNumber: newLicense },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `Another contractor already has license number ${newLicense}` },
        { status: 409 }
      );
    }
  }

  // The license the VERIFIED check below should look at: the new one if
  // this request is setting it, otherwise the one on file.
  const effectiveLicense = newLicense ?? existing.licenseNumber;

  const nextStatus: VerificationStatus | undefined = hasStatus
    ? (body.verificationStatus as VerificationStatus)
    : undefined;

  if (confirmReverify && existing.verificationStatus !== 'VERIFIED' && nextStatus !== 'VERIFIED') {
    return NextResponse.json(
      { error: 'Only a Verified contractor has an update to confirm. Set their status instead.' },
      { status: 400 }
    );
  }
  // Re-stamp the verification date whenever admin has just (re)checked a
  // Verified contractor: confirming an update, or correcting their license.
  const restampVerified =
    (existing.verificationStatus === 'VERIFIED' && (confirmReverify || licenseChanging) && nextStatus !== 'PENDING' && nextStatus !== 'REJECTED');
  const clearReverify = hasStatus || confirmReverify;

  // A PENDING-* license number means no real license has been looked up
  // yet (see src/lib/license.ts) — block flipping such a contractor to
  // Verified even though this route can't fix the license itself.
  if (
    hasStatus &&
    body.verificationStatus === 'VERIFIED' &&
    isPlaceholderLicense(effectiveLicense)
  ) {
    return NextResponse.json(
      {
        error:
          'This contractor has a placeholder license number (no real license on file) and cannot be marked Verified. Add the real license number first.',
      },
      { status: 400 }
    );
  }

  // No location on file: see the comment above PATCH.
  if (
    hasStatus &&
    body.verificationStatus === 'VERIFIED' &&
    (!existing.city.trim() || !existing.area.trim())
  ) {
    return NextResponse.json(
      {
        error:
          'This contractor has no location on file and cannot be marked Verified. They need to add their city and area in their profile first.',
      },
      { status: 400 }
    );
  }

  // Three-checks rule (KALM-221): a contractor can only BECOME Verified once
  // Documents, GSTIN and Spoke to them are all ticked. Looks at the ticks as
  // they will be after this request (so ticking and verifying in one go
  // works). Profiles that are already Verified are not re-tested here: they
  // keep their badge, and the rule applies the next time they move into
  // Verified from another status.
  if (
    hasStatus &&
    body.verificationStatus === 'VERIFIED' &&
    existing.verificationStatus !== 'VERIFIED'
  ) {
    const tick = (key: 'documents' | 'gstin' | 'contact', current: Date | null) =>
      hasChecks && typeof body.checks[key] === 'boolean' ? body.checks[key] : !!current;
    const missing = [
      !tick('documents', existing.checkDocumentsAt) && 'Documents',
      !tick('gstin', existing.checkGstinAt) && 'GSTIN',
      !tick('contact', existing.checkContactAt) && 'Spoke to them',
    ].filter(Boolean);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Tick all three checks before marking Verified. Still missing: ${missing.join(', ')}.` },
        { status: 400 }
      );
    }
  }

  const checkData: Record<string, Date | null> = {};
  if (hasChecks) {
    const now = new Date();
    for (const [key, column] of [
      ['documents', 'checkDocumentsAt'],
      ['gstin', 'checkGstinAt'],
      ['contact', 'checkContactAt'],
    ] as const) {
      if (typeof body.checks[key] === 'boolean') checkData[column] = body.checks[key] ? now : null;
    }
  }

  const updated = await prisma.contractor.update({
    where: { id },
    data: {
      ...checkData,
      ...(nextStatus
        ? {
            verificationStatus: nextStatus,
            ...(nextStatus === 'VERIFIED'
              ? existing.verificationStatus === 'VERIFIED' && !licenseChanging
                ? {}
                : { verifiedAt: new Date() }
              : { verifiedAt: null }),
          }
        : {}),
      ...(restampVerified && !nextStatus ? { verifiedAt: new Date() } : {}),
      ...(clearReverify ? { reverifyPending: false, reverifyRequestedAt: null, reverifyFields: [] } : {}),
      ...(hasTier ? { tier: body.tier as ContractorTier } : {}),
      ...(licenseChanging ? { licenseNumber: newLicense } : {}),
      ...(newNote !== undefined ? { adminNote: newNote } : {}),
    },
    select: ADMIN_SAFE_CONTRACTOR_SELECT,
  });

  return NextResponse.json({ ok: true, contractor: updated });
}
