// src/app/api/project-posts/route.ts
//
// Creates a ProjectPost. Mirrors src/app/api/quote-requests/route.ts
// closely (same auth/role check, same rate limiting, same write-before-
// email ordering) — see that file's header comment for the emailSentAt
// reasoning, which applies identically here.
//
// The key difference from quote-requests: this has no contractorId at
// all. It notifies admin, not any contractor — see the ProjectPost schema
// comment for the full reasoning.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendProjectPostAdminEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';

const projectPostSchema = z.object({
  projectType: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  budgetRangeLabel: z.string().trim().min(1).max(100),
  details: z.string().trim().min(1).max(2000),
  contactPhone: z.string().trim().min(6).max(20),
});

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json({ error: 'You must be signed in to post a project' }, { status: 401 });
  }

  // Same per-developer limit and reasoning as quote-requests — this is a
  // separate bucket (different key prefix), so posting projects and
  // requesting quotes don't share one combined limit.
  if (!checkRateLimit(`project-post:${session.user.id}`, { maxAttempts: 20, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = projectPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const developer = await prisma.developer.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!developer) {
    return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  }

  const { projectType, location, budgetRangeLabel, details, contactPhone } = parsed.data;

  // Write first, email second — see file header comment.
  const projectPost = await prisma.projectPost.create({
    data: {
      developerId: session.user.id,
      projectType,
      location,
      budgetRangeLabel,
      details,
      contactPhone,
    },
  });

  const emailSent = await sendProjectPostAdminEmail({
    developerName: developer.name,
    developerEmail: developer.email,
    contactPhone,
    projectType,
    location,
    budgetRangeLabel,
    details,
  });

  if (emailSent) {
    await prisma.projectPost.update({
      where: { id: projectPost.id },
      data: { emailSentAt: new Date() },
    });
  }

  return NextResponse.json({ id: projectPost.id });
}
