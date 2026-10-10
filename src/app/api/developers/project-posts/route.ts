// src/app/api/developers/project-posts/route.ts
//
// GET: the signed-in developer's own posted projects (the "Post a project"
// form), newest first, with a plain progress summary for the "Your projects"
// tab: received, sent to how many contractors, and who has replied.
//
// Scope is the developer's own posts only (where developerId is the session
// user). The summary is COUNTS plus the contractors who have already written
// to this developer in a conversation (their name and the conversation id, which
// the developer can already see in Messages). It never says which contractors
// were alerted, and never returns a phone number or email. See the
// ProjectPost schema comment: matching stays a human decision.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_POSTS = 50;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const developerId = session.user.id as string;

  const rows = await prisma.projectPost.findMany({
    where: { developerId },
    orderBy: { createdAt: 'desc' },
    take: MAX_POSTS,
    select: {
      id: true,
      projectType: true,
      location: true,
      budgetRangeLabel: true,
      status: true,
      createdAt: true,
      // Only the contractor id, to count distinct contractors (an alert can be re-sent).
      alerts: { select: { contractorId: true } },
      conversations: {
        where: { kind: 'PROJECT' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, contractor: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json(
    rows.map((p) => ({
      id: p.id,
      projectType: p.projectType,
      location: p.location,
      budgetRangeLabel: p.budgetRangeLabel,
      status: p.status,
      createdAt: p.createdAt,
      alertedCount: new Set(p.alerts.map((a) => a.contractorId)).size,
      replies: p.conversations.map((c) => ({ id: c.id, contractorName: c.contractor.name })),
    }))
  );
}
