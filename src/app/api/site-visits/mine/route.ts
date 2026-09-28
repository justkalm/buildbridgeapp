// src/app/api/site-visits/mine/route.ts
//
// GET: the signed-in developer's or contractor's site visits, newest
// first, for the "Site visits" section of their dashboard. Each side only
// ever sees visits it's a party to.
//
// Project titles are resolved here (projectIds is a plain array, see the
// SiteVisit schema comment). A project the contractor has since deleted
// simply drops out of the list.
//
// What each side sees about the other:
//   - contractor sees the developer's name, email and the phone they gave
//     for the visit, since they need to coordinate site access;
//   - developer sees the contractor's name/slug and, once confirmed, the
//     meeting point. The contractor's phone is included only once the
//     visit is CONFIRMED, matching the "details are released when there's
//     a real engagement" approach used for quote requests.
//
// NOTIFICATIONS: each visit comes back with `isNew` (the other side acted
// since this side last looked; see the SiteVisit schema comment), and
// then every visit is marked seen for this side. Loading the dashboard
// list is what "seeing" means, so the Nav badge clears on the next poll
// and the "New" labels show exactly once.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id;
  if (!userId || (role !== 'developer' && role !== 'contractor')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const isDeveloper = role === 'developer';

  const visits = await prisma.siteVisit.findMany({
    where: isDeveloper ? { developerId: userId } : { contractorId: userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      status: true,
      projectIds: true,
      proposedSlots: true,
      confirmedSlot: true,
      developerNote: true,
      contactPhone: true,
      meetingPoint: true,
      responseNote: true,
      cancelledBy: true,
      createdAt: true,
      respondedAt: true,
      contractorId: true,
      lastActionAt: true,
      lastActionBy: true,
      developerSeenAt: true,
      contractorSeenAt: true,
      developer: { select: { name: true, email: true } },
      contractor: { select: { name: true, slug: true, phone: true } },
    },
  });

  const allProjectIds = [...new Set(visits.flatMap((v) => v.projectIds))];
  const projects = allProjectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: allProjectIds } },
        select: { id: true, title: true, contractorId: true },
      })
    : [];
  const titleById = new Map(projects.map((p) => [p.id, p]));

  const side = isDeveloper ? 'DEVELOPER' : 'CONTRACTOR';
  const newIds = new Set(
    visits
      .filter((v) => {
        if (!v.lastActionBy || v.lastActionBy === side) return false;
        const seenAt = isDeveloper ? v.developerSeenAt : v.contractorSeenAt;
        return !seenAt || v.lastActionAt > seenAt;
      })
      .map((v) => v.id)
  );
  if (newIds.size > 0) {
    await prisma.siteVisit.updateMany({
      where: { id: { in: [...newIds] } },
      data: isDeveloper ? { developerSeenAt: new Date() } : { contractorSeenAt: new Date() },
    });
  }

  return NextResponse.json(
    visits.map((v) => ({
      id: v.id,
      status: v.status,
      proposedSlots: v.proposedSlots,
      confirmedSlot: v.confirmedSlot,
      developerNote: v.developerNote,
      contactPhone: v.contactPhone,
      meetingPoint: v.meetingPoint,
      responseNote: v.responseNote,
      cancelledBy: v.cancelledBy,
      createdAt: v.createdAt,
      respondedAt: v.respondedAt,
      isNew: newIds.has(v.id),
      sites: v.projectIds
        .map((id) => titleById.get(id))
        .filter((p) => p && p.contractorId === v.contractorId)
        .map((p) => p!.title),
      contractor: {
        name: v.contractor.name,
        slug: v.contractor.slug,
        phone: isDeveloper && v.status !== 'CONFIRMED' ? null : v.contractor.phone,
      },
      developer: isDeveloper ? { name: v.developer.name } : { name: v.developer.name, email: v.developer.email },
    }))
  );
}
