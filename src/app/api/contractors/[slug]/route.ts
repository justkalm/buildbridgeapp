// src/app/api/contractors/[slug]/route.ts
//
// Returns one contractor with their project history, for the profile page.
// Note this does NOT return `phone` — a developer only gets the contractor's
// contact info released to them via a submitted quote request, matching the
// original product flow ("provide your number, they call you", not
// "browse everyone's number freely"). If a future feature needs to show
// phone numbers more openly, that's a deliberate product decision to make
// then, not a field to quietly add back here.
//
// Only returns VERIFIED contractors, same restriction as the browse
// listing in ../route.ts. This used to have no status filter at all —
// slugs are derived from business names (see the signup route's
// slugify()), so they're guessable/predictable, not secret; a PENDING or
// REJECTED contractor's full profile was reachable by anyone who guessed
// or found the slug, even though browse correctly hid them. findFirst
// instead of findUnique here specifically because Prisma's findUnique only
// accepts genuinely unique fields/compound-unique keys in `where` — slug
// alone is unique, but slug + verificationStatus together isn't a declared
// compound unique index, so findFirst is the correct tool for "unique
// slug, filtered by a non-unique condition".

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const contractor = await prisma.contractor.findFirst({
    where: { slug, verificationStatus: 'VERIFIED' },
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
