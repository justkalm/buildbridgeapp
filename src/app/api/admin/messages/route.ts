// src/app/api/admin/messages/route.ts
//
// Messaging ANALYTICS for admin — counts and activity, never message
// content. This is deliberately separate from the thread drill-in route
// (admin/quote-requests/[id]/messages), which DOES return content but
// only for one specific thread, opened as a deliberate action (see that
// route's header comment). This route is what admin sees by default —
// aggregate numbers, not a feed of what anyone actually said.
//
// Per-contractor breakdown also lists each contractor's individual threads
// (quoteRequestId, developer name, project type, message count, last
// message time) so the admin messages page can let admin browse straight
// to a thread instead of needing a quote-request ID pasted in from
// somewhere else. This is still METADATA ONLY — no message body is
// selected anywhere in this file. The drill-in route above remains the
// only place that returns actual message content, and is still reached
// the same deliberate way (one explicit "view conversation" click), just
// now optionally pre-filled by clicking a thread row here instead of
// typing/pasting an ID.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // One groupBy across ALL messages, keyed by quoteRequestId, gives every
  // thread's message count and last-message time in a single query. This
  // replaces the old N+1-shaped approach (a `quoteRequests: { select: {
  // _count } }` sub-select per contractor, which fanned out into one
  // extra count query per contractor under the hood) with one query whose
  // cost doesn't grow with the number of contractors.
  const [totalMessages, messageGroups, totalQuoteRequests, contractors] = await Promise.all([
    prisma.message.count(),
    prisma.message.groupBy({
      by: ['quoteRequestId'],
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.quoteRequest.count(),
    prisma.contractor.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { quoteRequests: true } },
      },
    }),
  ]);

  const totalThreadsStarted = messageGroups.length;

  // Metadata needed to render a thread row — deliberately NOT `select:
  // { messages: ... }` anywhere here, since that's the one thing this
  // route must never expose. Only fetched for quote requests that
  // actually have messages (i.e. appear in messageGroups) — a lead with
  // no reply yet isn't a "thread" to browse.
  const threadIds = messageGroups.map((g) => g.quoteRequestId);
  const threadMeta = threadIds.length
    ? await prisma.quoteRequest.findMany({
        where: { id: { in: threadIds } },
        select: {
          id: true,
          contractorId: true,
          projectType: true,
          developer: { select: { name: true } },
        },
      })
    : [];

  const messageGroupById = new Map(messageGroups.map((g) => [g.quoteRequestId, g]));
  const threadsByContractor = new Map<string, {
    quoteRequestId: string;
    developerName: string;
    projectType: string;
    messageCount: number;
    lastMessageAt: string;
  }[]>();
  for (const qr of threadMeta) {
    const group = messageGroupById.get(qr.id);
    if (!group || !group._max.createdAt) continue;
    const list = threadsByContractor.get(qr.contractorId) ?? [];
    list.push({
      quoteRequestId: qr.id,
      developerName: qr.developer.name,
      projectType: qr.projectType,
      messageCount: group._count._all,
      lastMessageAt: group._max.createdAt.toISOString(),
    });
    threadsByContractor.set(qr.contractorId, list);
  }
  // Most recently active thread first within each contractor.
  for (const list of threadsByContractor.values()) {
    list.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }

  // Per-contractor breakdown: how many of a contractor's quote requests
  // actually turned into a message thread, and how many messages total.
  // This is the number that actually answers "which leads turned into
  // real engagement" rather than just "how many leads were sent" — see
  // the reasoning in the project notes on why this matters more than a
  // raw QuoteRequest count alone.
  const contractorStats = contractors
    .map((c) => {
      const threads = threadsByContractor.get(c.id) ?? [];
      const totalMessagesForContractor = threads.reduce((sum, t) => sum + t.messageCount, 0);
      return {
        contractorId: c.id,
        contractorName: c.name,
        totalLeads: c._count.quoteRequests,
        threadsWithMessages: threads.length,
        totalMessages: totalMessagesForContractor,
        threads,
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
