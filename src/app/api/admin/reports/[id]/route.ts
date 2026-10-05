// src/app/api/admin/reports/[id]/route.ts
//
// Close a report (KALM-255): mark it ACTIONED (something was done) or
// DISMISSED (nothing needed doing). A written note is required either way,
// so the record shows each report was actually considered and why it ended
// as it did. Only an OPEN report can be closed (409 otherwise, e.g. a double
// click or two tabs). The status change and its ModerationLog row are written
// together. The admin login is one shared password, so the log records what
// was done and when, not which person did it.
//
// Hiding the reported project is a separate action on the project itself
// (PATCH /api/admin/projects/[id]/moderate), which the Reports page calls
// first when asked to "hide and close".

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { rejectCrossOrigin } from '@/lib/same-origin';

const schema = z.object({
  status: z.enum(['ACTIONED', 'DISMISSED']),
  note: z.string().trim().min(1, 'Please write what you decided and why').max(1000),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;

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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id }, select: { id: true, targetType: true, targetId: true } });
  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  const { status, note } = parsed.data;

  const closed = await prisma.$transaction(async (tx) => {
    const result = await tx.report.updateMany({
      where: { id, status: 'OPEN' },
      data: { status, resolutionNote: note, resolvedAt: new Date() },
    });
    if (result.count === 0) return false;
    await tx.moderationLog.create({
      data: {
        action: status === 'ACTIONED' ? 'report_actioned' : 'report_dismissed',
        targetType: report.targetType,
        targetId: report.targetId,
        reportId: id,
        note,
      },
    });
    return true;
  });

  if (!closed) {
    return NextResponse.json({ error: 'This report was already closed. Reload the page.' }, { status: 409 });
  }

  return NextResponse.json({ id, status });
}
