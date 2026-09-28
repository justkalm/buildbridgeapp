// src/app/api/site-visits/[id]/calendar/route.ts
//
// GET: downloads the calendar invite (.ics) for a CONFIRMED site visit,
// for the "Add to calendar" link on both dashboards. Same file the
// confirmation email attaches, so someone who missed or deleted the email
// can still get the visit into their calendar. Parties only.

import { NextResponse } from 'next/server';
import { getSiteVisitForParty, visitIcsFor } from '@/lib/site-visit-access';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await getSiteVisitForParty(id);
  if (!loaded || loaded.visit.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ics = visitIcsFor(loaded, loaded.party);
  if (!ics) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="site-visit.ics"',
      'Cache-Control': 'private, no-store',
    },
  });
}
