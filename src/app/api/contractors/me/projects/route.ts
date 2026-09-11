// src/app/api/contractors/me/projects/route.ts
//
// GET lists the logged-in contractor's own projects. POST creates a new
// one. Unlike PATCH /api/contractors/me (profile fields), adding a project
// does NOT reset verificationStatus — "Verified" is about the contractor's
// license being checked, not about independently confirming every project
// claim (the schema comment on Project already says these are
// "admin-entered from what the contractor reports, not independently
// verified" — that was true when admin typed them in, and it's equally
// true now that the contractor types them in directly; nothing about who
// enters the data changes its verification status).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireContractor() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'contractor') {
    return null;
  }
  return session.user.id as string;
}

export async function GET() {
  const contractorId = await requireContractor();
  if (!contractorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { contractorId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(projects);
}

const projectSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  developerName: z.string().trim().max(200).optional(),
  projectType: z.string().trim().max(200).optional(),
  completedYear: z.number().int().min(1950).max(2100).nullable().optional(),
  squareFeet: z.number().int().positive().nullable().optional(),
  elevationFloors: z.number().int().positive().nullable().optional(),
  committedDurationMonths: z.number().int().positive().nullable().optional(),
  actualDurationMonths: z.number().int().positive().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(20).default([]),
});

export async function POST(req: Request) {
  const contractorId = await requireContractor();
  if (!contractorId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const project = await prisma.project.create({
    data: { ...parsed.data, contractorId },
  });

  return NextResponse.json(project);
}
