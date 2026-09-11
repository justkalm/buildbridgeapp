// src/app/api/contractors/[slug]/route.ts
//
// Returns one contractor with their project history, for the profile page.
// Note this does NOT return `phone` — a developer only gets the contractor's
// contact info released to them via a submitted quote request, matching the
// original product flow ("provide your number, they call you", not
// "browse everyone's number freely"). If a future feature needs to show
// phone numbers more openly, that's a deliberate product decision to make
// then, not a field to quietly add back here.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const contractor = await prisma.contractor.findUnique({
    where: { slug },
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
      teamSizeMin: true,
      teamSizeMax: true,
      gstRegistered: true,
      insuranceCoverLakh: true,
      rating: true,
      reviewCount: true,
      licenseNumber: true,
      bio: true,
      projects: {
        select: {
          id: true,
          title: true,
          developerName: true,
          projectType: true,
          completedYear: true,
          squareFeet: true,
          elevationFloors: true,
          committedDurationMonths: true,
          actualDurationMonths: true,
          imageUrls: true,
        },
        orderBy: { completedYear: 'desc' },
      },
    },
  });

  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  return NextResponse.json(contractor);
}
