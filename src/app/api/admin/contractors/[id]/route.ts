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

// PATCH updates a contractor's verification status and/or tier. Gated the
// same way as DELETE above. Both fields are optional in the request body —
// existing callers that only send verificationStatus keep working
// unchanged; tier is a manual admin override only, not tied to billing
// (see the zod comment in the create route for why).
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

  if (!hasStatus && !hasTier) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  if (hasStatus && !VALID_STATUSES.includes(body.verificationStatus)) {
    return NextResponse.json({ error: 'Invalid verification status' }, { status: 400 });
  }

  if (hasTier && !VALID_TIERS.includes(body.tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const existing = await prisma.contractor.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  const updated = await prisma.contractor.update({
    where: { id },
    data: {
      ...(hasStatus ? { verificationStatus: body.verificationStatus as VerificationStatus } : {}),
      ...(hasTier ? { tier: body.tier as ContractorTier } : {}),
    },
    select: ADMIN_SAFE_CONTRACTOR_SELECT,
  });

  return NextResponse.json({ ok: true, contractor: updated });
}
