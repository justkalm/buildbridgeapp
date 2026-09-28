// src/app/api/admin/contractors/[id]/route.ts
//
// Single-contractor admin operations: delete one, or update its
// verification status. Gated by the same shared admin password session as
// the rest of /api/admin.
//
// DELETE cascades to that contractor's Projects AND their QuoteRequests —
// see the onDelete: Cascade on both relations in schema.prisma. This means
// deleting a contractor with real quote-request history permanently erases
// that history, not just the contractor's profile. There's no "soft delete"
// or undo here; the confirmation step lives in the admin UI, not here.

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { ADMIN_SAFE_CONTRACTOR_SELECT } from '@/lib/admin-contractor-select';
import { isPlaceholderLicense } from '@/lib/license';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  // select here only pulls what this handler actually needs (existence
  // check + the name for the response) — no reason to fetch the whole row,
  // password hash and reset/verify tokens included, just to check it
  // exists and delete it.
  const existing = await prisma.contractor.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  await prisma.contractor.delete({ where: { id } });

  return NextResponse.json({ ok: true, deletedName: existing.name });
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const hasStatus = 'verificationStatus' in body;
  const hasTier = 'tier' in body;
  const hasLicense = 'licenseNumber' in body;

  if (!hasStatus && !hasTier && !hasLicense) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
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
    select: { id: true, licenseNumber: true, verificationStatus: true, city: true, area: true },
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

  let nextStatus: VerificationStatus | undefined = hasStatus
    ? (body.verificationStatus as VerificationStatus)
    : undefined;
  if (licenseChanging && !hasStatus && existing.verificationStatus === 'VERIFIED') {
    nextStatus = 'PENDING';
  }

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

  const updated = await prisma.contractor.update({
    where: { id },
    data: {
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
      ...(hasTier ? { tier: body.tier as ContractorTier } : {}),
      ...(licenseChanging ? { licenseNumber: newLicense } : {}),
    },
    select: ADMIN_SAFE_CONTRACTOR_SELECT,
  });

  return NextResponse.json({ ok: true, contractor: updated });
}
