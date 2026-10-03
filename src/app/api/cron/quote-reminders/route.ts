// src/app/api/cron/quote-reminders/route.ts
//
// KALM-209. Runs once a day (vercel.json) and does two things for quote
// requests (kind QUOTE) that are still PENDING and have no message from the
// contractor:
//   - 2 days old: ONE reminder to the contractor (email + push). Skipped when
//     the lead is blurred for them (over the free cap), because they cannot
//     act on it and a nag would just be an upgrade push.
//   - 10 days old: ONE note to the developer ("no reply yet, try another").
// reminderSentAt / noReplyNoticeSentAt are stamped only after a send works, so
// a failed email is retried the next day, and nobody is emailed twice. Only
// requests from the last 30 days are looked at, so an old backlog is never
// emailed in one go (see REMINDERS_FROM). At most BATCH of each kind per run.
//
// Protected by CRON_SECRET: Vercel sends "Authorization: Bearer <CRON_SECRET>"
// on cron calls when that env var is set. If the secret is not set, the route
// refuses everything (fail closed).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendNoReplyNoticeEmail, sendQuoteReminderEmail } from '@/lib/email';
import { sendPush } from '@/lib/push';
import { isFullyVisibleLead } from '@/lib/create-quote-request';

const BATCH = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
// Requests made before this date are never reminded about, so the first run
// after launch cannot email people about old test requests (4 Oct 2026).
const REMINDERS_FROM = new Date('2026-10-05T00:00:00+05:30');

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const now = Date.now();
  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  const windowStart = new Date(Math.max(now - 30 * DAY_MS, REMINDERS_FROM.getTime()));
  const noContractorReply = { messages: { none: { senderRole: 'CONTRACTOR' as const } } };
  const stillWaiting = {
    kind: 'QUOTE' as const,
    status: 'PENDING' as const,
    ...noContractorReply,
  };

  // 1) Reminders to contractors, 2 days in.
  const toRemind = await prisma.quoteRequest.findMany({
    where: { ...stillWaiting, reminderSentAt: null, createdAt: { gte: windowStart, lte: new Date(now - 2 * DAY_MS) } },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: {
      id: true,
      projectType: true,
      location: true,
      contractor: { select: { id: true, name: true, email: true, passwordHash: true } },
    },
  });
  let reminded = 0;
  for (const r of toRemind) {
    if (!r.contractor.passwordHash) continue; // placeholder profile, no account to remind
    if (!(await isFullyVisibleLead(r.contractor.id, r.id))) continue;
    const sent = await sendQuoteReminderEmail({
      toEmail: r.contractor.email,
      contractorName: r.contractor.name,
      projectType: r.projectType,
      location: r.location,
      dashboardUrl: `${baseUrl}/contractor/dashboard`,
    });
    if (!sent) continue;
    await sendPush('CONTRACTOR', r.contractor.id, {
      title: 'A quote request is waiting',
      body: `${r.projectType} in ${r.location}`,
      url: '/contractor/dashboard',
      tag: `quote-reminder-${r.id}`,
    });
    await prisma.quoteRequest.update({ where: { id: r.id }, data: { reminderSentAt: new Date() } });
    reminded++;
  }

  // 2) No-reply notices to developers, 10 days in.
  const toNotify = await prisma.quoteRequest.findMany({
    where: { ...stillWaiting, noReplyNoticeSentAt: null, createdAt: { gte: windowStart, lte: new Date(now - 10 * DAY_MS) } },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: {
      id: true,
      projectType: true,
      contractor: { select: { name: true } },
      developer: { select: { name: true, email: true } },
    },
  });
  let notified = 0;
  for (const r of toNotify) {
    const sent = await sendNoReplyNoticeEmail({
      toEmail: r.developer.email,
      toName: r.developer.name,
      contractorName: r.contractor.name,
      projectType: r.projectType,
      browseUrl: `${baseUrl}/browse`,
    });
    if (!sent) continue;
    await prisma.quoteRequest.update({ where: { id: r.id }, data: { noReplyNoticeSentAt: new Date() } });
    notified++;
  }

  return NextResponse.json({ ok: true, reminded, notified });
}
