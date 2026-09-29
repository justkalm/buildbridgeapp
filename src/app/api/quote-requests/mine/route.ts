// src/app/api/quote-requests/mine/route.ts
//
// Returns the signed-in developer's own quote requests, for the dashboard.
// Scoped strictly to session.user.id — a developer can only ever see their
// own requests, never another developer's.
//
// Also drives the developer's in-app notifications: a request whose status
// changed since the developer last saw it (statusUpdatedAt after
// developerStatusSeenAt) comes back with isNew: true and is then marked
// seen, so the "New" label shows once and the Nav badge clears.

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
    // Quote requests only; enquiries and project conversations are in
    // Messages (/api/conversations).
    where: { developerId: session.user.id, kind: 'QUOTE' },
    select: {
      id: true,
      projectType: true,
      location: true,
      status: true,
      statusUpdatedAt: true,
      developerStatusSeenAt: true,
      createdAt: true,
      emailSentAt: true,
      contractor: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const newIds = requests
    .filter((r) => r.statusUpdatedAt && (!r.developerStatusSeenAt || r.statusUpdatedAt > r.developerStatusSeenAt))
    .map((r) => r.id);
  if (newIds.length > 0) {
    await prisma.quoteRequest.updateMany({
      where: { id: { in: newIds } },
      data: { developerStatusSeenAt: new Date() },
    });
  }
  const newSet = new Set(newIds);

  return NextResponse.json(
    requests.map(({ developerStatusSeenAt: _seen, ...r }) => ({ ...r, isNew: newSet.has(r.id) }))
  );
}
