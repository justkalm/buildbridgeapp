// src/app/api/site-visits/[id]/route.ts
//
// PATCH: respond to or cancel a site visit. Body is one of:
//   { action: 'confirm', slot, meetingPoint, note? }  contractor, while REQUESTED
//   { action: 'decline', note? }                        contractor, while REQUESTED
//   { action: 'cancel',  note? }                        either side, while REQUESTED or CONFIRMED
//
// A developer can't confirm or decline (it's the contractor's answer), and
// a confirmed visit whose time has already passed can't be cancelled
// (there's nothing left to call off). `slot` must be exactly one of the
// times the developer offered: the contractor picks, they don't invent a
// new time. If none of the offered times work, the honest answer is to
// decline with a note, and the developer can request again.
//
// Every update is written with `where: { id, status: <expected> }` so two
// near-simultaneous actions (contractor confirms while developer cancels)
// can't both win. The loser gets a 409 and a prompt to refresh.
//
// Emails go out after the change is saved, via after(), so a slow email
// provider never makes the button feel stuck. Confirmation emails BOTH
// sides with a calendar invite; decline emails the developer; cancel
// emails whoever didn't cancel.

import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSiteVisitForParty, visitIcsFor } from '@/lib/site-visit-access';
import { formatVisitTime } from '@/lib/site-visits';
import {
  sendSiteVisitCancelledEmail,
  sendSiteVisitConfirmedEmail,
  sendSiteVisitDeclinedEmail,
} from '@/lib/email';
import { sendPush } from '@/lib/push';
import { lockedLeadIdsAmong } from '@/lib/quote-request-access';
import { siteVisitIsLocked } from '@/lib/lead-limits';

// In-app notification bookkeeping (see the SiteVisit schema comment): the
// contractor just acted, so the change is new for the developer and
// already seen by the contractor.
function contractorActed(now: Date) {
  return { lastActionAt: now, lastActionBy: 'CONTRACTOR' as const, contractorSeenAt: now };
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('confirm'),
    slot: z.iso.datetime(),
    meetingPoint: z.string().trim().min(3, 'Please say where to meet').max(500),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal('decline'), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('cancel'), note: z.string().trim().max(1000).optional() }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await getSiteVisitForParty(id);
  if (!loaded) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { visit, party } = loaded;
  const userId = party === 'DEVELOPER' ? visit.developerId : visit.contractorId;

  // A site visit request is a lead. On the free plan, requests past the
  // monthly five are locked for the contractor: they cannot confirm, decline
  // or cancel them until they upgrade (the developer can still cancel their
  // own request). Same rule as a locked message thread.
  const lockedForContractor = siteVisitIsLocked(
    visit.status,
    (await lockedLeadIdsAmong(visit.contractorId, [{ id: visit.id, createdAt: visit.createdAt }])).has(visit.id)
  );
  if (party === 'CONTRACTOR' && lockedForContractor) {
    return NextResponse.json(
      { error: 'This visit request is past the free leads on your plan this month. Upgrade to see and answer it.' },
      { status: 403 }
    );
  }

  if (!(await checkRateLimit(`site-visit-update:${userId}`, { maxAttempts: 60, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: 'Too many updates. Please try again later.' }, { status: 429 });
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
  const body = parsed.data;
  const note = body.note || null;
  const now = new Date();
  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  const stale = NextResponse.json(
    { error: 'This visit was just updated somewhere else. Refresh to see where it stands.' },
    { status: 409 }
  );

  if (body.action === 'confirm' || body.action === 'decline') {
    if (party !== 'CONTRACTOR') {
      return NextResponse.json({ error: 'Only the contractor can respond to a visit request.' }, { status: 403 });
    }
    if (visit.status !== 'REQUESTED') {
      return NextResponse.json({ error: 'This request has already been answered or cancelled.' }, { status: 409 });
    }
  }

  if (body.action === 'confirm') {
    const slot = new Date(body.slot);
    const offered = visit.proposedSlots.some((s) => s.getTime() === slot.getTime());
    if (!offered) {
      return NextResponse.json({ error: 'Please pick one of the times the developer offered.' }, { status: 400 });
    }
    if (slot.getTime() < now.getTime()) {
      return NextResponse.json(
        { error: 'That time has already passed. Decline with a note so the developer can offer new times.' },
        { status: 400 }
      );
    }

    const { count } = await prisma.siteVisit.updateMany({
      where: { id, status: 'REQUESTED' },
      data: {
        status: 'CONFIRMED',
        confirmedSlot: slot,
        meetingPoint: body.meetingPoint,
        responseNote: note,
        respondedAt: now,
        ...contractorActed(now),
      },
    });
    if (count === 0) return stale;

    const confirmed = {
      ...loaded,
      visit: { ...visit, status: 'CONFIRMED' as const, confirmedSlot: slot, meetingPoint: body.meetingPoint, responseNote: note },
    };
    after(async () => {
      await Promise.all([
        sendPush('DEVELOPER', visit.developerId, {
          title: `Site visit confirmed: ${visit.contractor.name}`,
          body: formatVisitTime(slot),
          url: '/dashboard#site-visits',
          tag: `site-visit-${visit.id}`,
        }),
        sendSiteVisitConfirmedEmail({
          toEmail: visit.developer.email,
          toName: visit.developer.name,
          otherPartyLine: `with ${visit.contractor.name}`,
          siteTitles: loaded.siteTitles,
          slot,
          meetingPoint: body.meetingPoint,
          responseNote: note,
          contactLine: `Contractor's phone for the day: ${visit.contractor.phone}`,
          icsContent: visitIcsFor(confirmed, 'DEVELOPER')!,
          dashboardUrl: `${baseUrl}/dashboard#site-visits`,
        }),
        sendSiteVisitConfirmedEmail({
          toEmail: visit.contractor.email,
          toName: visit.contractor.name,
          otherPartyLine: `from ${visit.developer.name}`,
          siteTitles: loaded.siteTitles,
          slot,
          meetingPoint: body.meetingPoint,
          responseNote: note,
          contactLine: `Developer's phone for the day: ${visit.contactPhone}`,
          icsContent: visitIcsFor(confirmed, 'CONTRACTOR')!,
          dashboardUrl: `${baseUrl}/contractor/dashboard#site-visits`,
        }),
      ]);
    });
    return NextResponse.json({ status: 'CONFIRMED' });
  }

  if (body.action === 'decline') {
    const { count } = await prisma.siteVisit.updateMany({
      where: { id, status: 'REQUESTED' },
      data: { status: 'DECLINED', responseNote: note, respondedAt: now, ...contractorActed(now) },
    });
    if (count === 0) return stale;

    after(() =>
      Promise.all([
        sendPush('DEVELOPER', visit.developerId, {
          title: `${visit.contractor.name} declined your site visit`,
          body: note ?? 'You can request again with different times.',
          url: '/dashboard#site-visits',
          tag: `site-visit-${visit.id}`,
        }),
        sendSiteVisitDeclinedEmail({
        toEmail: visit.developer.email,
        toName: visit.developer.name,
        contractorName: visit.contractor.name,
        responseNote: note,
        profileUrl: `${baseUrl}/contractors/${visit.contractor.slug}`,
      }),
      ])
    );
    return NextResponse.json({ status: 'DECLINED' });
  }

  // cancel
  if (visit.status !== 'REQUESTED' && visit.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'This visit is already closed.' }, { status: 409 });
  }
  if (visit.status === 'CONFIRMED' && visit.confirmedSlot && visit.confirmedSlot.getTime() < now.getTime()) {
    return NextResponse.json({ error: 'This visit has already taken place.' }, { status: 409 });
  }
  const { count } = await prisma.siteVisit.updateMany({
    where: { id, status: visit.status },
    data: {
      status: 'CANCELLED',
      cancelledBy: party,
      responseNote: note ?? visit.responseNote,
      lastActionAt: now,
      lastActionBy: party,
      ...(party === 'DEVELOPER' ? { developerSeenAt: now } : { contractorSeenAt: now }),
    },
  });
  if (count === 0) return stale;

  const toDeveloper = party === 'CONTRACTOR';
  after(() =>
    Promise.all([
      sendPush(toDeveloper ? 'DEVELOPER' : 'CONTRACTOR', toDeveloper ? visit.developerId : visit.contractorId, {
        title: `Site visit cancelled by ${toDeveloper ? visit.contractor.name : visit.developer.name}`,
        body: visit.confirmedSlot ? `Was planned for ${formatVisitTime(visit.confirmedSlot)}` : 'The visit request was withdrawn.',
        url: `${toDeveloper ? '/dashboard' : '/contractor/dashboard'}#site-visits`,
        tag: `site-visit-${visit.id}`,
      }),
      sendSiteVisitCancelledEmail({
      toEmail: toDeveloper ? visit.developer.email : visit.contractor.email,
      toName: toDeveloper ? visit.developer.name : visit.contractor.name,
      cancelledByName: toDeveloper ? visit.contractor.name : visit.developer.name,
      slotLine: visit.confirmedSlot ? `planned for ${formatVisitTime(visit.confirmedSlot)}` : 'you were arranging',
      // A developer's cancel note can hold a phone number. If this visit is
      // locked for the contractor, the email carries no note.
      note: party === 'DEVELOPER' && lockedForContractor ? null : note,
      dashboardUrl: `${baseUrl}${toDeveloper ? '/dashboard' : '/contractor/dashboard'}#site-visits`,
    }),
    ])
  );
  return NextResponse.json({ status: 'CANCELLED' });
}
