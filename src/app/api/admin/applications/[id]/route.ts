// src/app/api/admin/applications/[id]/route.ts
//
// One contractor onboarding form (from /join). Admin only.
//   GET   - the form, used to prefill "Add a Contractor".
//   PATCH - change its status (NEW, ADDED, REJECTED) and/or the admin note.
//   DELETE - remove the form for good, with its logo and photos on Blob
//            (for spam, or when a contractor asks us to delete their
//            details). Only files in the join/ folder are deleted, and
//            never one a listing still uses: "Add as contractor" copies the
//            same URLs onto the Contractor and its Projects, so deleting
//            those would take the photos off the live listing.
// Nothing here creates or changes a Contractor: the listing is still made
// with the normal Add a Contractor form.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { readJoinProjects } from '@/lib/join-form';
import { rejectCrossOrigin } from '@/lib/same-origin';
import { del } from '@vercel/blob';

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

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { id } = await params;
  const row = await prisma.contractorApplication.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const urls = [row.logoUrl, ...readJoinProjects(row.projects).flatMap((p) => p.imageUrls)].filter(
    (u): u is string => {
      if (!u) return false;
      try {
        return new URL(u).pathname.startsWith('/join/');
      } catch {
        return false;
      }
    }
  );

  // Keep any file a listing still shows.
  let keep = new Set<string>();
  if (urls.length > 0) {
    const [logos, projects] = await Promise.all([
      prisma.contractor.findMany({ where: { logoUrl: { in: urls } }, select: { logoUrl: true } }),
      prisma.project.findMany({ where: { imageUrls: { hasSome: urls } }, select: { imageUrls: true } }),
    ]);
    keep = new Set([...logos.map((c) => c.logoUrl), ...projects.flatMap((p) => p.imageUrls)].filter((u): u is string => !!u));
  }
  const toDelete = urls.filter((u) => !keep.has(u));

  // Files first: if Blob fails, the row stays and admin can try again,
  // rather than the row going and the photos staying public with nothing
  // pointing at them.
  if (toDelete.length > 0) {
    try {
      await del(toDelete);
    } catch (err) {
      console.error('Failed to delete join form files from Vercel Blob:', err);
      return NextResponse.json({ error: 'Could not delete the photos. Please try again.' }, { status: 500 });
    }
  }

  await prisma.contractorApplication.delete({ where: { id } });
  return NextResponse.json({ ok: true, keptForListing: urls.length - toDelete.length });
}
