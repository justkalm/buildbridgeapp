// src/app/api/admin/applications/route.ts
//
// Lists the contractor onboarding forms sent in through /join, newest
// first, for /admin/applications. Admin only. The projects JSON is read
// back through readJoinProjects so an odd row can't break the page.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { readJoinProjects } from '@/lib/join-form';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const rows = await prisma.contractorApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return NextResponse.json(rows.map((r) => ({ ...r, projects: readJoinProjects(r.projects) })));
}
