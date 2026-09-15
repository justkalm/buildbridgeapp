// src/app/api/developers/shortlist/route.ts
//
// GET lists the signed-in developer's shortlisted contractors, with each
// contractor's key comparison fields included (trade types, experience,
// project count, location) — this is what powers both the shortlist list
// and the compare table on the dashboard, so it returns everything either
// view needs rather than having two separate endpoints.
//
// POST adds a contractor to the shortlist, with an optional note. Uses
// upsert on the [developerId, contractorId] unique constraint — calling
// this again for an already-shortlisted contractor updates the note
// rather than erroring, since "shortlist this contractor" is naturally
// idempotent from the UI's point of view (the save button doesn't need to
// know whether this is the first save or an edit).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

async function requireDeveloper() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return null;
  }
  return session.user.id as string;
}

export async function GET() {
  const developerId = await requireDeveloper();
  if (!developerId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const shortlist = await prisma.shortlistedContractor.findMany({
    where: { developerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      note: true,
      createdAt: true,
      contractor: {
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          area: true,
          tradeTypes: true,
          verificationStatus: true,
          yearsInBusiness: true,
          rating: true,
          reviewCount: true,
          _count: { select: { projects: true } },
        },
      },
    },
  });

  return NextResponse.json(shortlist);
}

const addSchema = z.object({
  contractorId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  const developerId = await requireDeveloper();
  if (!developerId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  // Rate limited per developer — this is a lightweight write, but nothing
  // stops a logged-in account from scripting rapid add/remove calls
  // without a limit, and every other mutating route in the app has one.
  if (!checkRateLimit(`shortlist-add:${developerId}`, { maxAttempts: 60, windowMs: 60 * 60 * 1000 })) {
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

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { contractorId, note } = parsed.data;

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true },
  });
  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  const entry = await prisma.shortlistedContractor.upsert({
    where: { developerId_contractorId: { developerId, contractorId } },
    create: { developerId, contractorId, note },
    update: { note },
    select: { id: true, note: true, createdAt: true },
  });

  return NextResponse.json(entry);
}
