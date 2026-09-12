// src/app/api/quote-requests/mine/route.ts
//
// Returns the signed-in developer's own quote requests, for the dashboard.
// Scoped strictly to session.user.id — a developer can only ever see their
// own requests, never another developer's.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();

  // Explicit role check — same reasoning as the POST route in
  // src/app/api/quote-requests/route.ts: this was already effectively
  // safe (a contractor's ID never matches a developerId on any
  // QuoteRequest row), but only incidentally so.
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const requests = await prisma.quoteRequest.findMany({
    where: { developerId: session.user.id },
    select: {
      id: true,
      projectType: true,
      location: true,
      status: true,
      createdAt: true,
      emailSentAt: true,
      contractor: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(requests);
}
