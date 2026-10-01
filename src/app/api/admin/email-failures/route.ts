// src/app/api/admin/email-failures/route.ts
//
// The latest 100 emails the app tried to send and couldn't (see
// recordEmailFailure in src/lib/email.ts). Read-only, admin only. Rows hold
// just the email's label, recipient and a short error, never the body.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const failures = await prisma.emailFailure.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, createdAt: true, label: true, to: true, error: true },
  });

  return NextResponse.json(failures);
}
