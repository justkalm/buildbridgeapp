// src/lib/month-leads.ts
//
// Every lead a contractor has received since `monthStart`: quote requests of
// any kind AND site visit requests, oldest first (ids and dates only). This is
// the ONE list the free-plan cap is decided from, so every place that applies
// the cap (dashboard, Messages, notifications, site visits, unread badge)
// agrees. See mergeMonthLeads in src/lib/lead-limits.ts.

import { prisma } from '@/lib/prisma';
import { mergeMonthLeads } from '@/lib/lead-limits';

export async function monthLeadsFor(
  contractorId: string,
  monthStart: Date
): Promise<{ id: string; createdAt: Date }[]> {
  const where = { contractorId, createdAt: { gte: monthStart } };
  const [quoteRequests, siteVisits] = await Promise.all([
    prisma.quoteRequest.findMany({ where, select: { id: true, createdAt: true } }),
    prisma.siteVisit.findMany({ where, select: { id: true, createdAt: true } }),
  ]);
  return mergeMonthLeads(quoteRequests, siteVisits);
}
