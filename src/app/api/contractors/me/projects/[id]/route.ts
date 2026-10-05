// src/app/api/contractors/me/projects/[id]/route.ts
//
// PATCH updates one of the logged-in contractor's own projects; DELETE
// removes it. Both check contractorId === session user's id before
// touching anything — without that check, a contractor could edit or
// delete another contractor's project just by guessing/enumerating an id,
// since Project ids aren't secret. This is the actual security boundary;
// the UI never offering another contractor's project id is not enough on
// its own.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { positiveWhole } from '@/lib/project-validation';
import { isOwnBlobImageUrl } from '@/lib/validate-image-url';
import { checkRateLimit } from '@/lib/rate-limit';
import { recomputeContractorRating } from '@/lib/recompute-rating';
import { sendProjectForReviewEmail } from '@/lib/email';
import { SITE_URL } from '@/lib/site';

async function requireContractor() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'contractor') {
    return null;
  }
  return session.user.id as string;
}

const projectUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  developerName: z.string().trim().max(200).optional(),
  projectType: z.string().trim().max(200).optional(),
  squareFeet: positiveWhole('Sq ft').nullable().optional(),
  elevationFloors: positiveWhole('Floors').nullable().optional(),
  committedDurationMonths: positiveWhole('Committed duration').nullable().optional(),
  actualDurationMonths: positiveWhole('Actual duration').nullable().optional(),
  imageUrls: z
    .array(z.string().url())
    .max(20)
    .refine((urls) => urls.every(isOwnBlobImageUrl), {
      message: 'Image URLs must come from this app\'s own upload endpoint',
    })
    .optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const contractorId = await requireContractor();
  if (!contractorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Same reasoning and limit as project creation — see the POST route in
  // ../route.ts. Separate bucket (different key prefix) so create and
  // edit don't share one combined limit.
  if (!(await checkRateLimit(`project-edit:${contractorId}`, { maxAttempts: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const { id } = await params;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== contractorId) {
    // 404, not 403 — don't reveal whether a project id exists for a
    // contractor other than the caller.
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = projectUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  // Every edit sends the project back to review (owner's call, 6 Oct), so
  // new photos or changed text never go public unseen. It also covers a
  // HIDDEN project: the contractor can resubmit it, but it stays out of
  // public view until the admin looks at it again (the admin's earlier
  // moderationNote is kept so the reviewer sees why it was hidden).
  const updated = await prisma.project.update({
    where: { id },
    data: { ...parsed.data, approvalStatus: 'PENDING', submittedAt: new Date() },
  });
  // The edit took the project out of public view, so its review (if any)
  // stops counting toward the public rating until it is approved again.
  await recomputeContractorRating(contractorId);

  // An edit puts it back in the queue, so tell the admin inbox (never throws;
  // see the POST route in ../route.ts).
  const owner = await prisma.contractor.findUnique({ where: { id: contractorId }, select: { name: true } });
  await sendProjectForReviewEmail({
    contractorName: owner?.name ?? 'A contractor',
    projectTitle: updated.title,
    photoCount: updated.imageUrls.length,
    kind: 'edited',
    reviewUrl: `${SITE_URL}/admin/review`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const contractorId = await requireContractor();
  if (!contractorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Same limit as create/edit — see the POST route in ../route.ts.
  if (!(await checkRateLimit(`project-delete:${contractorId}`, { maxAttempts: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const { id } = await params;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing || existing.contractorId !== contractorId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
