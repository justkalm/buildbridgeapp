// src/app/api/reports/route.ts
//
// POST: anyone can report content (KALM-254), logged in or not. The
// "Report" buttons on profiles, projects and message threads all open
// /report, which posts here.
//
// What is checked, and why:
//  - Same origin and a per-IP rate limit, so this cannot be scripted into a
//    way to flood the admin inbox.
//  - The reporter's identity comes from the login session, never from the
//    request body, so nobody can file a report as someone else.
//  - A logged-out reporter must give an email, so there is a way to reach them.
//  - The target must exist. A PROJECT must be one the public can see
//    (APPROVED). A MESSAGE report must come from someone who is actually in
//    that conversation, so the form cannot be used to probe for thread ids,
//    and the message text is never copied into the report or the email.
// The admin is emailed in the background, after the response.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { rejectCrossOrigin } from '@/lib/same-origin';
import { getQuoteRequestParty } from '@/lib/quote-request-access';
import { sendReportEmail } from '@/lib/email';
import { SITE_URL } from '@/lib/site';
import { REPORT_REASON_KEYS, REPORTABLE_TARGETS, reasonLabel } from '@/lib/reports';

const schema = z
  .object({
    targetType: z.enum(REPORTABLE_TARGETS),
    // A contractor's slug, a project id or a conversation id. Not used for OTHER.
    targetId: z.string().trim().min(1).max(200).optional(),
    reason: z.enum(REPORT_REASON_KEYS),
    details: z.string().trim().max(2000).optional(),
    email: z.string().trim().email('Enter a valid email address').max(320).optional(),
  })
  .refine((v) => v.targetType === 'OTHER' || !!v.targetId, { message: 'Tell us what you are reporting' })
  .refine((v) => (v.reason !== 'other' && v.targetType !== 'OTHER') || !!v.details, {
    message: 'Please describe what you saw',
  });

export async function POST(req: Request) {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;

  const ip = getClientIp(req);
  if (!(await checkRateLimit(`report:${ip}`, { maxAttempts: 10, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: 'Too many reports from this connection. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const v = parsed.data;

  // Who is reporting: from the session only.
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; email?: string | null } | undefined;
  const reporterId = user?.id ?? null;
  const reporterRole = user?.role ?? null;
  const reporterEmail = (user?.email ?? v.email ?? '').trim() || null;
  if (!reporterEmail) {
    return NextResponse.json({ error: 'Please give an email address so we can reach you' }, { status: 400 });
  }

  // Resolve and check the target.
  let targetId: string | null = null;
  let targetSummary = 'A general report (not about one profile, project or message)';
  if (v.targetType === 'CONTRACTOR') {
    const c = await prisma.contractor.findFirst({
      where: { OR: [{ slug: v.targetId }, { id: v.targetId }] },
      select: { id: true, name: true },
    });
    if (!c) return NextResponse.json({ error: 'We could not find that profile' }, { status: 400 });
    targetId = c.id;
    targetSummary = `Contractor profile: ${c.name}`;
  } else if (v.targetType === 'PROJECT') {
    const p = await prisma.project.findFirst({
      where: { id: v.targetId, approvalStatus: 'APPROVED' },
      select: { id: true, title: true, contractor: { select: { name: true } } },
    });
    if (!p) return NextResponse.json({ error: 'We could not find that project' }, { status: 400 });
    targetId = p.id;
    targetSummary = `Project "${p.title}" by ${p.contractor.name}`;
  } else if (v.targetType === 'MESSAGE') {
    const party = await getQuoteRequestParty(v.targetId as string);
    if (!party) return NextResponse.json({ error: 'We could not find that conversation' }, { status: 400 });
    targetId = v.targetId as string;
    targetSummary = 'A message conversation (open it from the admin Messages page)';
  }

  const report = await prisma.report.create({
    data: {
      targetType: v.targetType,
      targetId,
      reason: v.reason,
      details: v.details || null,
      reporterId,
      reporterRole,
      reporterEmail,
    },
    select: { id: true },
  });

  after(async () => {
    try {
      await sendReportEmail({
        reasonLabel: reasonLabel(v.reason),
        targetSummary,
        details: v.details ?? '',
        reporterEmail,
        reporterRole,
        reportsUrl: `${SITE_URL}/admin/reports`,
      });
    } catch (err) {
      console.error('Report email failed:', err);
    }
  });

  return NextResponse.json({ ok: true, id: report.id });
}
