// src/app/api/admin/contractors/[id]/projects/route.ts
//
// Lists one contractor's projects for the admin review-editing panel on
// /admin/contractors. Fetched on demand when a row expands, not upfront
// for every contractor in the list — most contractors' projects are never
// looked at in a given admin session, so eagerly including them in the
// main list response would mean fetching and shipping a lot of data
// nobody ends up using.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  const projects = await prisma.project.findMany({
    where: { contractorId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      developerName: true,
      completedYear: true,
      reviewRating: true,
      reviewText: true,
      reviewedAt: true,
    },
  });

  return NextResponse.json(projects);
}
