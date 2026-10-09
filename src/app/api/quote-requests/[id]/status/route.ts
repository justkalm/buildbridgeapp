// src/app/api/quote-requests/[id]/status/route.ts
//
// PATCH: the contractor a quote request was sent to moves it along
// (talking to them / quote sent / not interested, or Undo back to New),
// and the developer is emailed.
//
// Contractor-only. The developer can't change status: it's the
// contractor's answer, and a developer "accepting" on their behalf would
// make the status meaningless. Access goes through getQuoteRequestParty,
// the same check the message thread uses, so a LISTED contractor over their
// monthly lead cap can't act on a blurred lead by calling this directly.
//
// Transition rules live in src/lib/quote-status.ts. The update is written
// with `where: { id, status: current }` so two near-simultaneous clicks
// (say, Accept in one tab and Decline in another) can't both succeed: the
// second finds the status already changed, updates nothing, and gets a 409.
//
// Same ordering as the quote request POST: save the change FIRST, then try
// the email. A failed email doesn't undo the status change, since the
// developer sees it on their dashboard regardless.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { getQuoteRequestParty } from '@/lib/quote-request-access';
import { canTransition, developerStatusLabel, developerUndoNotice } from '@/lib/quote-status';
import { sendQuoteStatusEmail } from '@/lib/email';
import { sendPush } from '@/lib/push';

const statusSchema = z.object({
  // PENDING is the Undo move (back to New); see ALLOWED_TRANSITIONS.
  status: z.enum(['PENDING', 'CONTACTED', 'QUOTED', 'DECLINED']),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const party = await getQuoteRequestParty(id);
  if (!party || party.role !== 'CONTRACTOR') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Each change sends an email, so cap it. 60/hour is far more than any
  // contractor working through their leads by hand would need.
  if (!(await checkRateLimit(`quote-status:${party.userId}`, { maxAttempts: 60, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: 'Too many updates. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const next = parsed.data.status;

  const current = await prisma.quoteRequest.findUnique({
    where: { id },
    select: {
      kind: true,
      status: true,
      projectType: true,
      developerId: true,
      contractor: { select: { name: true } },
      developer: { select: { name: true, email: true } },
    },
  });
  if (!current) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Enquiries and project conversations are chats, not quote requests, so
  // they have no Accept / Quote sent / Decline status.
  if (current.kind !== 'QUOTE') {
    return NextResponse.json({ error: 'Only quote requests have a status.' }, { status: 400 });
  }

  if (!canTransition(current.status, next)) {
    return NextResponse.json(
      { error: `This request can't be changed from ${current.status.toLowerCase()} to ${next.toLowerCase()}.` },
      { status: 409 }
    );
  }

  const now = new Date();
  const { count } = await prisma.quoteRequest.updateMany({
    where: { id, status: current.status },
    data: { status: next, statusUpdatedAt: now },
  });
  if (count === 0) {
    return NextResponse.json(
      { error: 'This request was just updated somewhere else. Refresh to see its current status.' },
      { status: 409 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  // An undo (back to New) is worded as a withdrawn update, so the developer
  // isn't left with an earlier email that is no longer true.
  const notice = next === 'PENDING' ? developerUndoNotice : developerStatusLabel[next];
  // Phone/browser notification alongside the email (owner's rule: every
  // notification goes by email and in the app). Never throws.
  await sendPush('DEVELOPER', current.developerId, {
    title: `${current.contractor.name}: ${notice}`,
    body: `Your quote request for ${current.projectType}`,
    url: '/dashboard',
    tag: `quote-status-${id}`,
  });

  const emailSent = await sendQuoteStatusEmail({
    toEmail: current.developer.email,
    toName: current.developer.name,
    contractorName: current.contractor.name,
    projectType: current.projectType,
    statusLabel: notice,
    dashboardUrl: `${baseUrl}/dashboard`,
  });

  return NextResponse.json({ status: next, statusUpdatedAt: now, emailSent });
}
