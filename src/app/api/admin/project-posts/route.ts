// src/app/api/admin/project-posts/route.ts
//
// Lists ProjectPosts for the admin view, including which contractors have
// already been alerted about each one (so the admin UI can show "already
// alerted: X, Y" and avoid the same admin double-alerting the same
// contractor by mistake — though that's not blocked outright, see
// ProjectPostAlert schema comment on why duplicates are a non-issue, not
// prevented).

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const projectPosts = await prisma.projectPost.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      projectType: true,
      location: true,
      budgetRangeLabel: true,
      details: true,
      contactPhone: true,
      status: true,
      createdAt: true,
      developer: { select: { name: true, email: true } },
      alerts: {
        select: {
          alertedAt: true,
          contractor: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json(projectPosts);
}
