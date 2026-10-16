// src/app/api/admin/applications/[id]/route.ts
//
// One contractor onboarding form (from /join). Admin only.
//   GET   - the form, used to prefill "Add a Contractor".
//   PATCH - change its status (NEW, ADDED, REJECTED) and/or the admin note.
// Nothing here creates or changes a Contractor: the listing is still made
// with the normal Add a Contractor form.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { readJoinProjects } from '@/lib/join-form';
import { rejectCrossOrigin } from '@/lib/same-origin';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;
  const row = await prisma.contractorApplication.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ...row, projects: readJoinProjects(row.projects) });
}

const patchSchema = z
  .object({
    status: z.enum(['NEW', 'ADDED', 'REJECTED']).optional(),
    adminNote: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNote !== undefined, { message: 'Nothing to change' });

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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const existing = await prisma.contractorApplication.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updated = await prisma.contractorApplication.update({
    where: { id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.adminNote !== undefined ? { adminNote: parsed.data.adminNote || null } : {}),
    },
    select: { id: true, status: true, adminNote: true },
  });
  return NextResponse.json(updated);
}
