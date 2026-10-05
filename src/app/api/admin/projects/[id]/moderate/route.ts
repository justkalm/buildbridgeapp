// src/app/api/admin/projects/[id]/moderate/route.ts
//
// Approve a project, or hide one (KALM-252, 253). Admin-only. Works on a
// project in any state, so the admin can also take down a project that is
// already live, or restore a hidden one.
//
//   approve: the project becomes public.
//   hide:    the project is taken out of public view but KEPT (not deleted),
//            so there is a record of what it was. A reason is required: it
//            is shown to the contractor and kept in the moderation log.
//
// STALE-CLICK GUARD: the page sends the submittedAt it was showing. If the
// contractor edited the project after the admin loaded it, submittedAt has
// moved on, nothing is changed, and the admin gets a 409 asking to reload.
// This is what stops content from being approved unseen.
//
// Every action writes a ModerationLog row (what, when, why). The admin login
// is one shared password, so the log cannot say which person acted.
//
// Hiding does NOT delete the photo files: they stay in storage at their
// links. See the safeguards plan, section on photo files.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { recomputeContractorRating } from '@/lib/recompute-rating';
import { rejectCrossOrigin } from '@/lib/same-origin';

// submittedAt as the page saw it (null for projects that were never edited
// by a contractor, such as admin-created ones).
const seen = z.string().datetime().nullable();

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), submittedAt: seen }),
  z.object({
    action: z.literal('hide'),
    submittedAt: seen,
    note: z.string().trim().min(1, 'Please give a reason').max(500),
  }),
]);

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

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, contractorId: true } });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const hide = parsed.data.action === 'hide';
  const note = parsed.data.action === 'hide' ? parsed.data.note : null;
  const seenAt = parsed.data.submittedAt ? new Date(parsed.data.submittedAt) : null;

  // The status change and its log entry succeed or fail together. The
  // submittedAt condition makes the update a no-op if the contractor
  // edited in the meantime.
  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.project.updateMany({
      where: { id, submittedAt: seenAt },
      data: {
        approvalStatus: hide ? 'HIDDEN' : 'APPROVED',
        moderatedAt: new Date(),
        // Approving clears an old "why it was hidden" note; hiding sets it.
        moderationNote: note,
      },
    });
    if (result.count === 0) return false;
    await tx.moderationLog.create({
      data: {
        action: hide ? 'project_hidden' : 'project_approved',
        targetType: 'PROJECT',
        targetId: id,
        note,
      },
    });
    return true;
  });

  if (!changed) {
    return NextResponse.json(
      { error: 'This project was changed after you opened it. Reload the page and look again.' },
      { status: 409 },
    );
  }

  // Approving or hiding changes which reviews count toward the public rating.
  await recomputeContractorRating(project.contractorId);

  return NextResponse.json({ id, approvalStatus: hide ? 'HIDDEN' : 'APPROVED' });
}
