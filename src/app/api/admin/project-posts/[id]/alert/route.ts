// src/app/api/admin/project-posts/[id]/alert/route.ts
//
// Sends a ProjectPost alert to one or more contractors. THIS IS WHERE
// "alerts are PRO-only" actually gets enforced — see the ProjectPost
// schema comment for why that rule lives here and not in the schema
// itself. Every contractorId in the request is checked against tier
// before anything is written; a non-PRO id in the list fails the whole
// request rather than silently skipping it, so admin gets clear feedback
// instead of a partial, confusing result.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { sendProjectPostAlertEmail } from '@/lib/email';

const alertSchema = z.object({
  contractorIds: z.array(z.string().min(1)).min(1).max(20),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = alertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const projectPost = await prisma.projectPost.findUnique({ where: { id } });
  if (!projectPost) {
    return NextResponse.json({ error: 'Project post not found' }, { status: 404 });
  }

  const { contractorIds } = parsed.data;

  const contractors = await prisma.contractor.findMany({
    where: { id: { in: contractorIds } },
    select: { id: true, name: true, email: true, tier: true },
  });

  if (contractors.length !== contractorIds.length) {
    return NextResponse.json({ error: 'One or more contractors not found' }, { status: 404 });
  }

  // The actual PRO-only enforcement. A non-PRO id anywhere in the request
  // fails the whole thing — no partial alerts, no silent skips.
  const nonPro = contractors.filter((c) => c.tier !== 'PRO');
  if (nonPro.length > 0) {
    return NextResponse.json(
      {
        error: `Project alerts are PRO-only. Not PRO: ${nonPro.map((c) => c.name).join(', ')}`,
      },
      { status: 400 }
    );
  }

  // Create the alert records first (same write-before-email ordering as
  // quote requests and project post submission — see those files for
  // reasoning), then attempt emails. Each contractor's email success/
  // failure is independent; one failing doesn't roll back the others.
  const alerts = await prisma.$transaction(
    contractors.map((c) =>
      prisma.projectPostAlert.create({
        data: { projectPostId: id, contractorId: c.id },
      })
    )
  );

  await prisma.projectPost.update({
    where: { id },
    data: { status: 'MATCHED' },
  });

  const results = await Promise.all(
    contractors.map((c) =>
      sendProjectPostAlertEmail({
        toEmail: c.email,
        toName: c.name,
        projectType: projectPost.projectType,
        location: projectPost.location,
        budgetRangeLabel: projectPost.budgetRangeLabel,
        details: projectPost.details,
      })
    )
  );

  const failedCount = results.filter((sent) => !sent).length;

  return NextResponse.json({
    ok: true,
    alertedCount: alerts.length,
    emailFailedCount: failedCount,
  });
}
