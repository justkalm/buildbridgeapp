// src/app/api/admin/messages/route.ts
//
// Messaging ANALYTICS for admin — counts and activity, never message
// content. This is deliberately separate from the thread drill-in route
// (admin/quote-requests/[id]/messages), which DOES return content but
// only for one specific thread, opened as a deliberate action (see that
// route's header comment). This route is what admin sees by default —
// aggregate numbers, not a feed of what anyone actually said.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const [totalMessages, totalThreadsStarted, totalQuoteRequests] = await Promise.all([
    prisma.message.count(),
    // "Threads started" = distinct QuoteRequests that have at least one
    // message — computed via groupBy rather than a naive count, since a
    // QuoteRequest can have many messages but should only count once here.
    prisma.message.groupBy({ by: ['quoteRequestId'] }).then((groups) => groups.length),
    prisma.quoteRequest.count(),
  ]);

  // Per-contractor breakdown: how many of a contractor's quote requests
  // actually turned into a message thread, and how many messages total.
  // This is the number that actually answers "which leads turned into
  // real engagement" rather than just "how many leads were sent" — see
  // the reasoning in the project notes on why this matters more than a
  // raw QuoteRequest count alone.
  const perContractor = await prisma.contractor.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { quoteRequests: true } },
      quoteRequests: {
        select: {
          id: true,
          _count: { select: { messages: true } },
        },
      },
    },
  });

  const contractorStats = perContractor
    .map((c) => {
      const threadsWithMessages = c.quoteRequests.filter((qr) => qr._count.messages > 0).length;
      const totalMessagesForContractor = c.quoteRequests.reduce((sum, qr) => sum + qr._count.messages, 0);
      return {
        contractorId: c.id,
        contractorName: c.name,
        totalLeads: c._count.quoteRequests,
        threadsWithMessages,
        totalMessages: totalMessagesForContractor,
      };
    })
    // Only show contractors who've actually had at least one lead — a
    // contractor with zero leads has nothing meaningful to report here,
    // and there could be many of them cluttering the list otherwise.
    .filter((c) => c.totalLeads > 0)
    .sort((a, b) => b.totalMessages - a.totalMessages);

  return NextResponse.json({
    totalMessages,
    totalThreadsStarted,
    totalQuoteRequests,
    engagementRate: totalQuoteRequests > 0 ? totalThreadsStarted / totalQuoteRequests : 0,
    contractorStats,
  });
}
