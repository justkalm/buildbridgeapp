// src/app/api/admin/projects/[id]/review/route.ts
//
// Sets, updates, or clears the review on ONE project. Admin-only — there
// is no equivalent developer- or contractor-facing route, deliberately.
// See the reviewRating/reviewText comment on the Project model in
// schema.prisma for the actual collection process this supports (founder
// gets the review from the developer directly, types it in here).
//
// PATCH with { rating, text } sets a review. PATCH with { rating: null }
// clears it (e.g. correcting a mistaken entry). Either way, the
// contractor's aggregate rating/reviewCount is recomputed from scratch
// afterward — never incremented/decremented in place, which would drift
// from reality if a review is ever edited or removed.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { recomputeContractorRating } from '@/lib/recompute-rating';

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5).nullable(),
  text: z.string().trim().max(2000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, contractorId: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { rating, text } = parsed.data;

  const updated = await prisma.project.update({
    where: { id },
    data: {
      reviewRating: rating,
      reviewText: rating === null ? null : (text ?? null),
      reviewedAt: rating === null ? null : new Date(),
    },
    select: { id: true, reviewRating: true, reviewText: true, reviewedAt: true },
  });

  // Recompute rather than increment/decrement — see file header comment.
  await recomputeContractorRating(project.contractorId);

  return NextResponse.json(updated);
}
