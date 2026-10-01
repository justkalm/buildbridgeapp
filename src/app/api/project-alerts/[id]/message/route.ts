// src/app/api/project-alerts/[id]/message/route.ts
//
// POST { body }: a contractor messages the developer behind a project
// alert ("I'm interested"). The one place a contractor may START a
// conversation: the developer asked to be connected by posting the project
// and admin picked this contractor for it (see QuoteRequestKind PROJECT in
// schema.prisma). Anyone else still can't cold-message developers.
//
// The alert must belong to the signed-in contractor, and they must be on a
// paid tier (alerts are a PRO perk; the dashboard hides alerts from LISTED
// contractors, so this mirrors that). One conversation per contractor per
// posted project: a second "I'm interested" adds to the existing thread.
// Returns { id } of the conversation (open it at /messages/[id]).

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { notifyNewMessage } from '@/lib/message-notifications';

const bodySchema = z.object({ body: z.string().trim().min(1, 'Write a short message first.').max(2000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const contractorId = session?.user?.id;
  if (!contractorId || (session.user as { role?: string }).role !== 'contractor') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const alert = await prisma.projectPostAlert.findUnique({
    where: { id },
    select: {
      contractorId: true,
      contractor: { select: { tier: true } },
      projectPost: {
        select: {
          id: true,
          developerId: true,
          projectType: true,
          location: true,
          budgetRangeLabel: true,
          details: true,
          contactPhone: true,
        },
      },
    },
  });
  if (!alert || alert.contractorId !== contractorId || alert.contractor.tier === 'LISTED') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!(await checkRateLimit(`message-send:${contractorId}`, { maxAttempts: 60, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const body = parsed.data.body;
  const post = alert.projectPost;
  const now = new Date();

  const existing = await prisma.quoteRequest.findFirst({
    where: { kind: 'PROJECT', contractorId, projectPostId: post.id },
    select: { id: true },
  });

  let conversationId: string;
  if (existing) {
    await prisma.$transaction([
      prisma.message.create({ data: { quoteRequestId: existing.id, senderRole: 'CONTRACTOR', body } }),
      prisma.quoteRequest.update({ where: { id: existing.id }, data: { contractorLastReadAt: now } }),
    ]);
    conversationId = existing.id;
  } else {
    const created = await prisma.quoteRequest.create({
      data: {
        kind: 'PROJECT',
        projectPostId: post.id,
        contractorId,
        developerId: post.developerId,
        projectType: post.projectType,
        location: post.location,
        budgetRangeLabel: post.budgetRangeLabel,
        details: post.details,
        contactPhone: post.contactPhone,
        // Started by the contractor, so it's already seen on their side.
        contractorLastReadAt: now,
        contractorSeenAt: now,
        developerStatusSeenAt: now,
        messages: { create: { senderRole: 'CONTRACTOR', body } },
      },
      select: { id: true },
    });
    conversationId = created.id;
  }

  after(() => notifyNewMessage(conversationId, 'CONTRACTOR', body));
  return NextResponse.json({ id: conversationId });
}
