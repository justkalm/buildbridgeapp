// src/app/api/quote-requests/[id]/messages/route.ts
//
// GET lists messages on a QuoteRequest thread; POST sends one. Reachable
// by EITHER the developer who made the request OR the contractor it was
// sent to — not by anyone else. Who counts as a party (including the
// contractor lead-cap check) is decided by getQuoteRequestParty in
// src/lib/quote-request-access.ts; see that file's header for the
// reasoning. There is no broader "any developer" or "any contractor"
// access here, this is strictly the two parties to this one conversation.
//
// This is additive to the existing email/phone reveal (see the
// QuoteRequestRow types on both dashboards) — sending a message here
// doesn't change or replace that, it's a second, optional channel.
//
// READ TRACKING: a GET by one party marks the thread read for that party
// (bumps developerLastReadAt / contractorLastReadAt). The client only
// polls this while the thread is open AND the browser tab is visible, so
// "loaded the thread" is a fair stand-in for "saw the messages". The
// unread counts themselves are computed in /api/messages/unread.
//
// NOTIFICATIONS: a POST tells the OTHER party by phone/browser
// notification and (at most once per unread batch) by email; see
// src/lib/message-notifications.ts. Sent with after(), i.e. once the
// response has gone back to the sender, so a slow email or push service
// never makes the chat feel laggy or makes a send look failed.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { getQuoteRequestParty } from '@/lib/quote-request-access';
import { notifyNewMessage } from '@/lib/message-notifications';

function lastReadField(role: 'DEVELOPER' | 'CONTRACTOR') {
  return role === 'DEVELOPER' ? 'developerLastReadAt' : 'contractorLastReadAt';
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const party = await getQuoteRequestParty(id);
  if (!party) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [messages] = await Promise.all([
    prisma.message.findMany({
      where: { quoteRequestId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, senderRole: true, body: true, createdAt: true },
    }),
    prisma.quoteRequest.update({
      where: { id },
      data: { [lastReadField(party.role)]: new Date() },
      select: { id: true },
    }),
  ]);

  return NextResponse.json(messages);
}

const sendSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const party = await getQuoteRequestParty(id);
  if (!party) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Rate limited per sender — a real-time-feeling chat is exactly the
  // kind of feature that invites rapid-fire scripted spam if uncapped.
  if (!(await checkRateLimit(`message-send:${party.userId}`, { maxAttempts: 60, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json(
      { error: 'Too many messages. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        quoteRequestId: id,
        senderRole: party.role,
        body: parsed.data.body,
      },
      select: { id: true, senderRole: true, body: true, createdAt: true },
    }),
    // Sending a message means you've seen the thread up to now, so this
    // also clears the sender's own unread count.
    prisma.quoteRequest.update({
      where: { id },
      data: { [lastReadField(party.role)]: now },
      select: { id: true },
    }),
  ]);

  after(() => notifyNewMessage(id, party.role, parsed.data.body));

  return NextResponse.json(message);
}
