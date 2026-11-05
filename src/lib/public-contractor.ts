// src/lib/public-contractor.ts
//
// One contractor's public profile: the single place that decides what the
// public may see. Used by the profile API (/api/contractors/<slug>) and by
// the profile page itself, which now loads it on the server so the profile
// is in the page Google downloads instead of a "Loading…" placeholder
// (SEO, 5 Nov 2026).
//
// Rules (unchanged from the API route): VERIFIED contractors only, approved
// projects only, no phone number, and the password hash is used only to
// work out acceptsSiteVisits, then dropped.
//
// cache(): the page and its layout (link preview) can both ask for the
// same slug in one request without a second database round trip.

import { cache } from 'react';
import { prisma } from '@/lib/prisma';

export const getPublicContractor = cache(async (slug: string) => {
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
      reverifyPending: true, // shows "Verified · update in review"; see VerifiedBadge
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
      // Only used to derive acceptsSiteVisits below, then stripped. The
      // hash itself must never reach the response.
      passwordHash: true,
      projects: {
        // Only approved projects are public (KALM-252).
        where: { approvalStatus: 'APPROVED' },
        select: {
          id: true,
          title: true,
          developerName: true,
          projectType: true,
          squareFeet: true,
          elevationFloors: true,
          committedDurationMonths: true,
          actualDurationMonths: true,
          imageUrls: true,
          reviewRating: true,
          reviewText: true,
        },
        // Newest-added first. Used to sort by completedYear, which the
        // project forms no longer ask for (the owner prefers the committed
        // and actual durations); the column still exists in the database.
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!contractor) return null;

  // acceptsSiteVisits: whether this contractor has claimed their account
  // and can therefore answer a site visit request (see
  // src/app/api/site-visits/route.ts). A boolean, never the hash.
  const { passwordHash, ...publicFields } = contractor;
  return { ...publicFields, acceptsSiteVisits: passwordHash !== null };
});

export type PublicContractor = NonNullable<Awaited<ReturnType<typeof getPublicContractor>>>;
