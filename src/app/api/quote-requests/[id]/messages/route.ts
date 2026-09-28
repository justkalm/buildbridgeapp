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
// EMAIL NOTIFICATION: a POST emails the OTHER party, at most once per
// unread batch — see the notifiedAt comment on QuoteRequest in
// schema.prisma. The email is sent with after(), i.e. once the response
// has already gone back to the sender, so a slow or failing email
// provider never makes the chat feel laggy or makes a send look failed.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { getQuoteRequestParty } from '@/lib/quote-request-access';
import { sendNewMessageEmail } from '@/lib/email';

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
  if (!checkRateLimit(`message-send:${party.userId}`, { maxAttempts: 60, windowMs: 60 * 60 * 1000 })) {
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

  after(() => notifyRecipient(id, party.role));

  return NextResponse.json(message);
}

// Emails the other party unless they've already been emailed since they
// last read this thread. Read-then-write rather than a single atomic
// update, so two messages sent in the same instant could both email. That
// worst case is one duplicate email, which isn't worth a raw-SQL
// column-to-column comparison to prevent.
async function notifyRecipient(quoteRequestId: string, senderRole: 'DEVELOPER' | 'CONTRACTOR') {
  const qr = await prisma.quoteRequest.findUnique({
    where: { id: quoteRequestId },
    select: {
      projectType: true,
      developerLastReadAt: true,
      contractorLastReadAt: true,
      developerNotifiedAt: true,
      contractorNotifiedAt: true,
      developer: { select: { name: true, email: true } },
      contractor: { select: { name: true, email: true, passwordHash: true } },
    },
  });
  if (!qr) return;

  const toDeveloper = senderRole === 'CONTRACTOR';
  const lastRead = toDeveloper ? qr.developerLastReadAt : qr.contractorLastReadAt;
  const lastNotified = toDeveloper ? qr.developerNotifiedAt : qr.contractorNotifiedAt;

  const alreadyNotifiedSinceLastRead = lastNotified !== null && (lastRead === null || lastNotified > lastRead);
  if (alreadyNotifiedSinceLastRead) return;

  // An admin-entered placeholder contractor with no password can't log in
  // to read the message anyway (and its email is often a placeholder
  // address), so there's nobody to notify.
  if (!toDeveloper && !qr.contractor.passwordHash) return;

  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  const sent = await sendNewMessageEmail({
    toEmail: toDeveloper ? qr.developer.email : qr.contractor.email,
    toName: toDeveloper ? qr.developer.name : qr.contractor.name,
    fromName: toDeveloper ? qr.contractor.name : qr.developer.name,
    projectType: qr.projectType,
    dashboardUrl: `${baseUrl}${toDeveloper ? '/dashboard' : '/contractor/dashboard'}`,
  });

  // Only record the notification if it actually went out, so a failed
  // send (e.g. Resend's test domain rejecting the address) doesn't
  // suppress the next attempt.
  if (sent) {
    await prisma.quoteRequest.update({
      where: { id: quoteRequestId },
      data: { [toDeveloper ? 'developerNotifiedAt' : 'contractorNotifiedAt']: new Date() },
      select: { id: true },
    });
  }
}
