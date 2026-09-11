// src/app/api/contractors/route.ts
//
// Returns contractors for the browse page. Supports basic filtering by
// area and trade type via query params — this is intentionally simple
// (no pagination, no full-text search) since we have a handful of
// hand-added contractors right now, not thousands. Add pagination when the
// count actually warrants it, not before.
//
// Only returns VERIFIED contractors by default. This is a deliberate
// product decision, not an oversight: a developer browsing the platform
// should see contractors whose licenses have actually been checked. Pass
// ?includeUnverified=true to see everything (useful for you, testing, or
// the future admin view) — this is not meant to be a public-facing param
// long-term; once the admin page exists, gate this behind admin auth too.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const area = searchParams.get('area');
  const trade = searchParams.get('trade');
  const includeUnverified = searchParams.get('includeUnverified') === 'true';

  const contractors = await prisma.contractor.findMany({
    where: {
      ...(includeUnverified ? {} : { verificationStatus: 'VERIFIED' }),
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
