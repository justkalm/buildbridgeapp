// src/app/api/developers/projects/route.ts
//
// GET: the signed-in developer's saved projects, newest first.
// POST: save a new one. See src/lib/saved-projects.ts.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  MAX_SAVED_PROJECTS,
  createSavedProject,
  savedProjectInputSchema,
  savedProjectSelect,
  toClient,
} from '@/lib/saved-projects';

async function requireDeveloper() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') return null;
  return session.user.id as string;
}

export async function GET() {
  const developerId = await requireDeveloper();
  if (!developerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const rows = await prisma.savedProject.findMany({
    where: { developerId },
    orderBy: { updatedAt: 'desc' },
    select: savedProjectSelect,
  });
  return NextResponse.json(rows.map(toClient));
}

export async function POST(req: NextRequest) {
  const developerId = await requireDeveloper();
  if (!developerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

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

  const project = await createSavedProject(developerId, parsed.data);
  if (!project) {
    return NextResponse.json(
      { error: `You can save up to ${MAX_SAVED_PROJECTS} projects. Delete one you no longer need first.` },
      { status: 400 }
    );
  }
  return NextResponse.json(project, { status: 201 });
}
