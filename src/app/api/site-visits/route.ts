// src/app/api/site-visits/route.ts
//
// POST: a developer asks to visit some of a contractor's completed
// projects in person (see the SiteVisit model in prisma/schema.prisma).
// Emails the contractor straight away.
//
// Who can request: a signed-in developer with a verified email (same rule
// as quote requests, since this also hands their phone number to a
// contractor and emails on their behalf). Who can be visited: a VERIFIED
// contractor who has claimed their account (passwordHash set). An
// admin-entered placeholder has nobody behind it to answer the request,
// so the profile page doesn't offer the button and this route refuses too.
//
// Numbers (3 time slots, 3–5 sites, notice period) come from
// src/lib/site-visits.ts so the form and this route can't disagree. Every
// project id is checked against the contractor's own projects, so a
// crafted request can't attach someone else's projects.
//
// One open request per developer per contractor: while a request is
// still waiting (REQUESTED), sending another is refused with a pointer to
// the dashboard. That stops accidental double-submits and repeated nagging
// without blocking a fresh request after a decline or cancellation.
//
// A site visit request counts as a lead toward the free plan's monthly five
// (see src/lib/month-leads.ts); past that it is locked for the contractor.
//
// Same ordering as quote requests: the row is saved first, then the email
// is attempted, and requestEmailSentAt records whether it went out.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireVerifiedDeveloperEmail } from '@/lib/require-verified-email';
import { sendSiteVisitRequestEmail } from '@/lib/email';
import { sendPush } from '@/lib/push';
import { blurredLeadIdsFor } from '@/lib/quote-request-access';
import { MAX_AHEAD_MS, MAX_SITES, MIN_NOTICE_MS, SLOT_COUNT, minSitesFor } from '@/lib/site-visits';

const requestSchema = z.object({
  contractorId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1).max(MAX_SITES),
  slots: z.array(z.iso.datetime()).length(SLOT_COUNT, `Please offer ${SLOT_COUNT} different times`),
  contactPhone: z.string().trim().min(6, 'Please enter a phone number').max(20),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json({ error: 'Please sign in as a developer to schedule a site visit.' }, { status: 401 });
  }
  const developerId = session.user.id;

  const unverified = await requireVerifiedDeveloperEmail(
    developerId,
    'Please verify your email before scheduling site visits. Check your inbox, or resend the link from your dashboard.'
  );
  if (unverified) return unverified;

  if (!(await checkRateLimit(`site-visit:${developerId}`, { maxAttempts: 10, windowMs: 24 * 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: 'You have sent a lot of visit requests today. Please try again tomorrow.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { contractorId, contactPhone, note } = parsed.data;
  const projectIds = [...new Set(parsed.data.projectIds)];

  // Times: all distinct, far enough ahead to arrange, not absurdly far out.
  const slots = parsed.data.slots.map((s) => new Date(s)).sort((a, b) => a.getTime() - b.getTime());
  const now = Date.now();
  if (new Set(slots.map((s) => s.getTime())).size !== SLOT_COUNT) {
    return NextResponse.json({ error: `Please offer ${SLOT_COUNT} different times.` }, { status: 400 });
  }
  if (slots.some((s) => s.getTime() < now + MIN_NOTICE_MS)) {
    return NextResponse.json({ error: 'Each time needs to be at least 12 hours from now.' }, { status: 400 });
  }
  if (slots.some((s) => s.getTime() > now + MAX_AHEAD_MS)) {
    return NextResponse.json({ error: 'Please pick times within the next 90 days.' }, { status: 400 });
  }

  const contractor = await prisma.contractor.findFirst({
    where: { id: contractorId, verificationStatus: 'VERIFIED' },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      // Only approved (public) projects can be picked (KALM-252).
      projects: { where: { approvalStatus: 'APPROVED' }, select: { id: true, title: true } },
    },
  });
  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }
  if (!contractor.passwordHash) {
    return NextResponse.json(
      { error: "This contractor hasn't activated their (kalm) account yet, so they can't receive visit requests." },
      { status: 409 }
    );
  }

  const ownProjects = new Map(contractor.projects.map((p) => [p.id, p.title]));
  if (projectIds.some((id) => !ownProjects.has(id))) {
    return NextResponse.json({ error: "One of the selected projects isn't listed by this contractor." }, { status: 400 });
  }
  const minSites = minSitesFor(ownProjects.size);
  if (projectIds.length < minSites) {
    return NextResponse.json({ error: `Please pick at least ${minSites} sites to visit.` }, { status: 400 });
  }

  const openRequest = await prisma.siteVisit.findFirst({
    where: { developerId, contractorId, status: 'REQUESTED' },
    select: { id: true },
  });
  if (openRequest) {
    return NextResponse.json(
      { error: 'You already have a visit request waiting with this contractor. You can see it on your dashboard.' },
      { status: 409 }
    );
  }

  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
    select: { name: true },
  });
  if (!developer) {
    return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  }

  const visit = await prisma.siteVisit.create({
    data: {
      developerId,
      contractorId,
      projectIds,
      proposedSlots: slots,
      contactPhone,
      developerNote: note || null,
      // In-app notification: new for the contractor, already seen by the
      // developer who just sent it.
      lastActionBy: 'DEVELOPER',
      developerSeenAt: new Date(),
    },
    select: { id: true },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  await sendPush('CONTRACTOR', contractorId, {
    title: 'New site visit request',
    body: `${developer.name} wants to visit ${projectIds.length} of your sites`,
    url: '/contractor/dashboard#site-visits',
    tag: `site-visit-${visit.id}`,
  });

  // A site visit request is a lead. If it is past a free contractor's monthly
  // five it is locked for them: the email leaves out the developer's own note
  // (it can hold a phone number), exactly as the new-quote email leaves out
  // the details of a blurred lead.
  const locked = (await blurredLeadIdsFor(contractorId)).has(visit.id);
  const emailSent = await sendSiteVisitRequestEmail({
    toEmail: contractor.email,
    contractorName: contractor.name,
    developerName: developer.name,
    siteTitles: projectIds.map((id) => ownProjects.get(id)!),
    slots,
    developerNote: locked ? null : note || null,
    dashboardUrl: `${baseUrl}/contractor/dashboard#site-visits`,
  });
  if (emailSent) {
    await prisma.siteVisit.update({ where: { id: visit.id }, data: { requestEmailSentAt: new Date() } });
  }

  return NextResponse.json({ id: visit.id, emailSent });
}
