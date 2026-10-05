// src/app/api/admin/review/route.ts
//
// The review desk (KALM-253). ?status=PENDING (default): every project a
// contractor has created or edited and not yet approved, oldest submission
// first. ?status=APPROVED lists live projects (so one can be taken down) and
// ?status=HIDDEN the ones taken down (so one can be restored). Admin-only.
// Pending and hidden projects are not public (see approvalStatus on the
// Project model).

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const asked = new URL(req.url).searchParams.get('status');
  const status = asked === 'APPROVED' || asked === 'HIDDEN' ? asked : 'PENDING';

  const pending = await prisma.project.findMany({
    where: { approvalStatus: status },
    // Oldest submission first; live projects were never submitted, so they
    // fall back to creation order.
    orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
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
      approvalStatus: true,
      submittedAt: true,
      moderationNote: true,
      moderatedAt: true,
      createdAt: true,
      contractor: { select: { id: true, name: true, slug: true, verificationStatus: true } },
    },
  });

  return NextResponse.json(pending);
}
