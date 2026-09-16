// src/lib/recompute-rating.ts
//
// Recalculates Contractor.rating and reviewCount from the reviews on
// their own projects (Project.reviewRating). These two fields are
// DERIVED, not independently editable — nothing should ever set
// contractor.rating directly; call this instead after any review is
// added, edited, or removed, so the aggregate always matches the actual
// underlying reviews. Call sites: the admin project review routes.

import { prisma } from '@/lib/prisma';

export async function recomputeContractorRating(contractorId: string): Promise<void> {
  const reviewed = await prisma.project.findMany({
    where: { contractorId, reviewRating: { not: null } },
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
