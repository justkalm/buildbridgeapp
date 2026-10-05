// src/lib/recompute-rating.ts
//
// Recalculates Contractor.rating and reviewCount from the reviews on
// their own projects (Project.reviewRating). These two fields are
// DERIVED, not independently editable — nothing should ever set
// contractor.rating directly; call this instead after any review is
// added, edited, or removed, so the aggregate always matches the actual
// underlying reviews. Call sites: the admin project review routes, the admin moderate route
// (approve or hide changes what counts), and the contractor's project edit and delete.

import { prisma } from '@/lib/prisma';

export async function recomputeContractorRating(contractorId: string): Promise<void> {
  const reviewed = await prisma.project.findMany({
    // Only approved projects count: a hidden or pending project's review
    // text is not public, so it must not move the public rating either.
    where: { contractorId, reviewRating: { not: null }, approvalStatus: 'APPROVED' },
    select: { reviewRating: true },
  });

  const reviewCount = reviewed.length;
  const rating =
    reviewCount === 0
      ? 0
      : reviewed.reduce((sum, p) => sum + (p.reviewRating ?? 0), 0) / reviewCount;

  await prisma.contractor.update({
    where: { id: contractorId },
    data: { rating, reviewCount },
  });
}
