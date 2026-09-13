// src/app/api/contractors/route.ts
//
// Returns contractors for the browse page. Supports basic filtering by
// area and trade type via query params — this is intentionally simple
// (no pagination, no full-text search) since we have a handful of
// hand-added contractors right now, not thousands. Add pagination when the
// count actually warrants it, not before.
//
// Only ever returns VERIFIED contractors — no query param can change this.
// A developer browsing the platform should see contractors whose licenses
// have actually been checked, full stop. This used to have an
// ?includeUnverified=true escape hatch with no auth check on it at all —
// anyone, not just admin, could see every PENDING/REJECTED contractor by
// adding that param to the URL. Removed rather than gated behind admin
// auth: nothing in the app actually used it (the admin contractors page
// has its own separate, properly-gated /api/admin/contractors endpoint
// that already returns everything), so there was no reason to keep the
// bypass around at all.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const area = searchParams.get('area');
  const trade = searchParams.get('trade');

  const contractors = await prisma.contractor.findMany({
    where: {
      verificationStatus: 'VERIFIED',
      ...(area ? { area: { equals: area, mode: 'insensitive' } } : {}),
      ...(trade ? { tradeTypes: { has: trade } } : {}),
    },
        select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      city: true,
      area: true,
      tradeTypes: true,
      verificationStatus: true,
      tier: true,
      yearsInBusiness: true,
      rating: true,
      reviewCount: true,
      licenseNumber: true,
      _count: { select: { projects: true } },
    },
    // Paid tiers surface first — the visible payoff for paying, once
    // tiers actually cost anything. PRO > PLUS > LISTED, then by rating
    // within each tier. Prisma's enum sort follows declaration order
    // (LISTED, PLUS, PRO) ascending, so 'desc' puts PRO first.
    orderBy: [{ tier: 'desc' }, { rating: 'desc' }],
  });

  return NextResponse.json(contractors);
}
