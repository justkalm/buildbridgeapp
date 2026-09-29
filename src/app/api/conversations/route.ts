// src/app/api/conversations/route.ts
//
// The Messages inbox.
//
// A "conversation" is one QuoteRequest thread: either a real quote request
// (kind QUOTE) or a developer's direct question from a contractor's
// profile (kind ENQUIRY; see the QuoteRequestKind comment in
// schema.prisma for why enquiries reuse QuoteRequest).
//
// GET: every conversation the signed-in developer or contractor is part
// of, newest activity first, with the other party, the last message, and
// this side's unread count. A LISTED contractor's blurred leads come back
// as `locked` rows with no message preview: they can see a lead exists
// (the same as on their dashboard) but not read it until they upgrade.
//
// POST (developers only): start or continue a conversation with a
// contractor. If the developer already has any conversation with them,
// that latest one is returned (and the message, if given, is added to it)
// so a developer never ends up with a pile of parallel threads from
// tapping "Message" repeatedly. Otherwise a new ENQUIRY is created with
// the first message. Contractors can reply but never start conversations:
// developers are the customers, and this stops contractors cold-messaging
// them.

import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireVerifiedDeveloperEmail } from '@/lib/require-verified-email';
import { blurredLeadIdsFor } from '@/lib/quote-request-access';
import { notifyNewMessage } from '@/lib/message-notifications';
import { conversationTitle } from '@/lib/conversations';

const PREVIEW_CHARS = 140;


export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (!userId || (role !== 'developer' && role !== 'contractor')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const isDeveloper = role === 'developer';
  const me = isDeveloper ? 'DEVELOPER' : 'CONTRACTOR';

  const threads = await prisma.quoteRequest.findMany({
    where: isDeveloper ? { developerId: userId } : { contractorId: userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      kind: true,
      projectType: true,
      location: true,
      createdAt: true,
      developerLastReadAt: true,
      contractorLastReadAt: true,
      developer: { select: { name: true } },
      contractor: { select: { name: true, slug: true, logoUrl: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { body: true, createdAt: true, senderRole: true },
      },
    },
  });

  const locked = isDeveloper ? new Set<string>() : await blurredLeadIdsFor(userId);

  const conversations = threads
    .map((t) => {
      const isLocked = locked.has(t.id);
      const last = t.messages[0] ?? null;
      const lastRead = isDeveloper ? t.developerLastReadAt : t.contractorLastReadAt;
      const unread = isLocked
        ? 0
        : t.messages.filter((m) => m.senderRole !== me && (!lastRead || m.createdAt > lastRead)).length;
      return {
        id: t.id,
        kind: t.kind,
        title: conversationTitle(t),
        otherParty: isDeveloper
          ? { name: t.contractor.name, slug: t.contractor.slug, logoUrl: t.contractor.logoUrl }
          : { name: t.developer.name, slug: null, logoUrl: null },
        lastMessage:
          last && !isLocked
            ? {
                body: last.body.length > PREVIEW_CHARS ? `${last.body.slice(0, PREVIEW_CHARS)}…` : last.body,
                createdAt: last.createdAt,
                fromMe: last.senderRole === me,
              }
            : null,
        unread,
        locked: isLocked,
        lastActivityAt: (last?.createdAt ?? t.createdAt).toISOString(),
      };
    })
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

  return NextResponse.json({ conversations });
}

const startSchema = z.object({
  contractorId: z.string().min(1),
  body: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json(
      { error: 'Only developer accounts can start a conversation.' },
      { status: session?.user?.id ? 403 : 401 }
    );
  }
  const developerId = session.user.id;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { contractorId } = parsed.data;
  const body = parsed.data.body || '';

  const contractor = await prisma.contractor.findFirst({
    where: { id: contractorId, verificationStatus: 'VERIFIED' },
    select: { id: true, area: true, city: true, passwordHash: true },
  });
  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }
  if (!contractor.passwordHash) {
    return NextResponse.json(
      { error: "This contractor hasn't activated their (kalm) account yet, so they can't receive messages." },
      { status: 409 }
    );
  }

  const existing = await prisma.quoteRequest.findFirst({
    where: { developerId, contractorId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (!existing && !body) {
    return NextResponse.json(
      { error: 'Write a message to start the conversation.', code: 'BODY_REQUIRED' },
      { status: 400 }
    );
  }

  // Everything past here sends someone a message, so it's gated like
  // quote requests (verified email when that rule is switched on) and
  // rate limited. A new enquiry is also a new lead for the contractor.
  if (body) {
    const unverified = await requireVerifiedDeveloperEmail(
      developerId,
      'Please verify your email before messaging contractors. Check your inbox, or resend the link from your dashboard.'
    );
    if (unverified) return unverified;
    if (!checkRateLimit(`message-send:${developerId}`, { maxAttempts: 60, windowMs: 60 * 60 * 1000 })) {
      return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 });
    }
  }

  if (existing) {
    if (body) {
      await prisma.$transaction([
        prisma.message.create({ data: { quoteRequestId: existing.id, senderRole: 'DEVELOPER', body } }),
        prisma.quoteRequest.update({ where: { id: existing.id }, data: { developerLastReadAt: new Date() } }),
      ]);
      after(() => notifyNewMessage(existing.id, 'DEVELOPER', body));
    }
    return NextResponse.json({ id: existing.id, existing: true });
  }

  if (!checkRateLimit(`enquiry-start:${developerId}`, { maxAttempts: 10, windowMs: 24 * 60 * 60 * 1000 })) {
    return NextResponse.json(
      { error: 'You have started a lot of new conversations today. Please try again tomorrow.' },
      { status: 429 }
    );
  }

  const developer = await prisma.developer.findUnique({ where: { id: developerId }, select: { phone: true } });
  if (!developer) {
    return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  }

  const now = new Date();
  const enquiry = await prisma.quoteRequest.create({
    data: {
      kind: 'ENQUIRY',
      contractorId,
      developerId,
      // QuoteRequest's quote fields are required; an enquiry fills them
      // with neutral values. They're never shown for kind ENQUIRY.
      projectType: 'General enquiry',
      location: [contractor.area, contractor.city].filter(Boolean).join(', ') || 'Not specified',
      budgetRangeLabel: 'Not specified',
      details: body.slice(0, 2000),
      contactPhone: developer.phone ?? '',
      developerLastReadAt: now,
      // Counts as seen by the developer; new for the contractor.
      developerStatusSeenAt: now,
      messages: { create: { senderRole: 'DEVELOPER', body } },
    },
    select: { id: true },
  });

  after(() => notifyNewMessage(enquiry.id, 'DEVELOPER', body));
  return NextResponse.json({ id: enquiry.id, existing: false });
}
