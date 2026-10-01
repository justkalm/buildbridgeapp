// src/app/api/developers/projects/[id]/route.ts
//
// PATCH: edit one of the signed-in developer's saved projects.
// DELETE: remove it. Both only ever touch a project owned by the signed-in
// developer: the where clause includes developerId, so someone else's
// project id simply isn't found (404), and nothing reveals it exists.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { savedProjectInputSchema, savedProjectSelect, toClient, toData } from '@/lib/saved-projects';

async function requireDeveloper() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') return null;
  return session.user.id as string;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const developerId = await requireDeveloper();
  if (!developerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;

  if (!(await checkRateLimit(`saved-project:${developerId}`, { maxAttempts: 30, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: 'Too many changes. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parsed = savedProjectInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { count } = await prisma.savedProject.updateMany({
    where: { id, developerId },
    data: toData(parsed.data),
  });
  if (count === 0) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const row = await prisma.savedProject.findUniqueOrThrow({ where: { id }, select: savedProjectSelect });
  return NextResponse.json(toClient(row));
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const developerId = await requireDeveloper();
  if (!developerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;

  const { count } = await prisma.savedProject.deleteMany({ where: { id, developerId } });
  if (count === 0) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
