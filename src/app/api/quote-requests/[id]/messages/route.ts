// src/app/api/quote-requests/[id]/messages/route.ts
//
// GET lists messages on a QuoteRequest thread; POST sends one. Reachable
// by EITHER the developer who made the request OR the contractor it was
// sent to — not by anyone else. The ownership check compares the
// authenticated session's role+id against the QuoteRequest's own
// developerId/contractorId; there is no broader "any developer" or "any
// contractor" access here, this is strictly the two parties to this one
// conversation.
//
// This is additive to the existing email/phone reveal (see the
// QuoteRequestRow types on both dashboards) — sending a message here
// doesn't change or replace that, it's a second, optional channel.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

async function getAuthorizedRole(
  quoteRequestId: string
): Promise<{ role: 'DEVELOPER' | 'CONTRACTOR'; userId: string } | null> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id as string | undefined;

  if (!userId || (role !== 'developer' && role !== 'contractor')) {
    return null;
  }

  const quoteRequest = await prisma.quoteRequest.findUnique({
    where: { id: quoteRequestId },
    select: { developerId: true, contractorId: true },
  });
  if (!quoteRequest) return null;

  if (role === 'developer' && quoteRequest.developerId === userId) {
    return { role: 'DEVELOPER', userId };
  }
  if (role === 'contractor' && quoteRequest.contractorId === userId) {
    return { role: 'CONTRACTOR', userId };
  }

  // Authenticated, but not a party to THIS thread — same 404-not-403
  // reasoning used elsewhere in the app (project ownership checks etc.):
  // don't confirm this quote request exists to someone who isn't part of
  // it.
  return null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authorized = await getAuthorizedRole(id);
  if (!authorized) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const messages = await prisma.message.findMany({
    where: { quoteRequestId: id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, senderRole: true, body: true, createdAt: true },
  });

  return NextResponse.json(messages);
}

const sendSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authorized = await getAuthorizedRole(id);
  if (!authorized) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Rate limited per sender — a real-time-feeling chat is exactly the
  // kind of feature that invites rapid-fire scripted spam if uncapped.
  if (!checkRateLimit(`message-send:${authorized.userId}`, { maxAttempts: 60, windowMs: 60 * 60 * 1000 })) {
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

  const message = await prisma.message.create({
    data: {
      quoteRequestId: id,
      senderRole: authorized.role,
      body: parsed.data.body,
    },
    select: { id: true, senderRole: true, body: true, createdAt: true },
  });

  return NextResponse.json(message);
}
