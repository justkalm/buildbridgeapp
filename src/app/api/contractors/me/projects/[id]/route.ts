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
import { isOwnBlobImageUrl } from '@/lib/validate-image-url';
import { checkRateLimit } from '@/lib/rate-limit';

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
  completedYear: z.number().int().min(1950).max(2100).nullable().optional(),
  squareFeet: z.number().int().positive().nullable().optional(),
  elevationFloors: z.number().int().positive().nullable().optional(),
  committedDurationMonths: z.number().int().positive().nullable().optional(),
  actualDurationMonths: z.number().int().positive().nullable().optional(),
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
  if (!checkRateLimit(`project-edit:${contractorId}`, { maxAttempts: 20, windowMs: 60 * 60 * 1000 })) {
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

  const updated = await prisma.project.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const contractorId = await requireContractor();
  if (!contractorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Same limit as create/edit — see the POST route in ../route.ts.
  if (!checkRateLimit(`project-delete:${contractorId}`, { maxAttempts: 20, windowMs: 60 * 60 * 1000 })) {
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
