// src/app/api/messages/unread/route.ts
//
// GET: unread in-app message counts for the signed-in developer or
// contractor, as { total, byQuoteRequest: { [quoteRequestId]: count },
// siteVisits }. `siteVisits` is the number of site visits the OTHER side
// has acted on since this side last opened their dashboard (see the
// SiteVisit schema comment). `total` includes it, so the Nav badge
// covers both kinds of notification.
//
// Polled by the Nav badge and both dashboards, so it's kept cheap: one
// query for message threads (only those that actually have messages from
// the other side) and one small query for site visits.
//
// "Unread" = sent by the OTHER side after this side's lastReadAt (see the
// QuoteRequest schema comment). Counting happens in JS rather than SQL
// because Prisma can't compare a message's createdAt against a column on
// its parent row in a single where-clause. Each thread is capped at its 50
// most recent incoming messages, which is plenty for a badge ("50+" is
// never going to be the difference between someone opening a thread or
// not).
//
// Contractor side respects the lead cap: a LISTED contractor's blurred
// leads are left out entirely. A developer can still message on a lead
// the contractor can't see yet (developers are never capped), and a badge
// pointing at a thread the contractor can't open would just be a dead end.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeLeadVisibility, getMonthStart } from '@/lib/lead-limits';

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;

  if (!userId || (role !== 'developer' && role !== 'contractor')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const isDeveloper = role === 'developer';

  const threads = await prisma.quoteRequest.findMany({
    where: {
      ...(isDeveloper ? { developerId: userId } : { contractorId: userId }),
      messages: { some: { senderRole: isDeveloper ? 'CONTRACTOR' : 'DEVELOPER' } },
    },
    select: {
      id: true,
      createdAt: true,
      developerLastReadAt: true,
      contractorLastReadAt: true,
      messages: {
        where: { senderRole: isDeveloper ? 'CONTRACTOR' : 'DEVELOPER' },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  let hidden = new Set<string>();
  if (!isDeveloper) {
    const contractor = await prisma.contractor.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    if (contractor?.tier === 'LISTED') {
      const monthStart = getMonthStart();
      const thisMonth = await prisma.quoteRequest.findMany({
        where: { contractorId: userId, createdAt: { gte: monthStart } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      const visibility = computeLeadVisibility(contractor.tier, thisMonth);
      hidden = new Set(thisMonth.filter((r) => visibility.get(r.id) !== 'full').map((r) => r.id));
    }
  }

  const byQuoteRequest: Record<string, number> = {};
  let total = 0;
  for (const t of threads) {
    if (hidden.has(t.id)) continue;
    const lastRead = isDeveloper ? t.developerLastReadAt : t.contractorLastReadAt;
    const count = lastRead ? t.messages.filter((m) => m.createdAt > lastRead).length : t.messages.length;
    if (count > 0) {
      byQuoteRequest[t.id] = count;
      total += count;
    }
  }

  const visitSide = isDeveloper ? 'DEVELOPER' : 'CONTRACTOR';
  const visits = await prisma.siteVisit.findMany({
    where: {
      ...(isDeveloper ? { developerId: userId } : { contractorId: userId }),
      lastActionBy: isDeveloper ? 'CONTRACTOR' : 'DEVELOPER',
    },
    select: { lastActionAt: true, developerSeenAt: true, contractorSeenAt: true },
    orderBy: { lastActionAt: 'desc' },
    take: 50,
  });
  const siteVisits = visits.filter((v) => {
    const seenAt = visitSide === 'DEVELOPER' ? v.developerSeenAt : v.contractorSeenAt;
    return !seenAt || v.lastActionAt > seenAt;
  }).length;

  return NextResponse.json({ total: total + siteVisits, byQuoteRequest, siteVisits });
}
