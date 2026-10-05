// src/lib/site-visit-access.ts
//
// Loads a site visit for the signed-in user IF they're one of its two
// parties, plus everything the respond/cancel route and the calendar
// download need (names, contact details, project titles). Returns null for
// "doesn't exist" and "not yours" alike, so callers answer both with the
// same 404 and never confirm a visit exists to an outsider.

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VISIT_DURATION_MS, formatVisitTime } from '@/lib/site-visits';
import { buildVisitIcs } from '@/lib/ics';

export async function getSiteVisitForParty(id: string) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (!userId || (role !== 'developer' && role !== 'contractor')) return null;

  const visit = await prisma.siteVisit.findUnique({
    where: { id },
    include: {
      developer: { select: { id: true, name: true, email: true } },
      contractor: {
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          // Only approved projects show on visit cards, emails and calendar
          // files. A project edited after the visit was requested is PENDING
          // again, and its new text must not reach the developer unreviewed.
          projects: { where: { approvalStatus: 'APPROVED' }, select: { id: true, title: true } },
        },
      },
    },
  });
  if (!visit) return null;

  const isDeveloper = role === 'developer' && visit.developerId === userId;
  const isContractor = role === 'contractor' && visit.contractorId === userId;
  if (!isDeveloper && !isContractor) return null;

  const titleById = new Map(visit.contractor.projects.map((p) => [p.id, p.title]));
  const siteTitles = visit.projectIds.map((pid) => titleById.get(pid)).filter((t): t is string => !!t);

  return { visit, siteTitles, party: isDeveloper ? ('DEVELOPER' as const) : ('CONTRACTOR' as const) };
}

type LoadedVisit = NonNullable<Awaited<ReturnType<typeof getSiteVisitForParty>>>;

// The .ics for a confirmed visit, worded for whichever side will open it.
export function visitIcsFor(loaded: LoadedVisit, forSide: 'DEVELOPER' | 'CONTRACTOR'): string | null {
  const { visit, siteTitles } = loaded;
  if (!visit.confirmedSlot) return null;
  const other =
    forSide === 'DEVELOPER'
      ? `${visit.contractor.name} (${visit.contractor.phone})`
      : `${visit.developer.name} (${visit.contactPhone})`;
  return buildVisitIcs({
    visitId: visit.id,
    start: visit.confirmedSlot,
    durationMs: VISIT_DURATION_MS,
    summary:
      forSide === 'DEVELOPER'
        ? `Site visit with ${visit.contractor.name}`
        : `Site visit: ${visit.developer.name}`,
    description: [
      `Site visit arranged through (kalm), ${formatVisitTime(visit.confirmedSlot)}.`,
      `With: ${other}`,
      `Sites: ${siteTitles.join('; ')}`,
      visit.meetingPoint ? `Meeting point: ${visit.meetingPoint}` : '',
      visit.responseNote ? `Note: ${visit.responseNote}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location: visit.meetingPoint,
  });
}
