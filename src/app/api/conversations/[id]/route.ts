// src/app/api/conversations/[id]/route.ts
//
// GET: the header details for one conversation screen: who it's with,
// what it's about, the quote's status (for kind QUOTE), and when the
// other side last read the thread (for "Seen" under your own messages).
// Messages themselves come from /api/quote-requests/[id]/messages.
//
// Parties only, via getQuoteRequestParty, which also refuses a LISTED
// contractor's blurred leads, so a locked conversation 404s here exactly
// as its messages do.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getQuoteRequestParty } from '@/lib/quote-request-access';
import { conversationTitle } from '@/lib/conversations';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const party = await getQuoteRequestParty(id);
  if (!party) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const qr = await prisma.quoteRequest.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      projectType: true,
      location: true,
      budgetRangeLabel: true,
      status: true,
      developerLastReadAt: true,
      contractorLastReadAt: true,
      developer: { select: { name: true } },
      contractor: { select: { name: true, slug: true, logoUrl: true } },
    },
  });
  if (!qr) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isDeveloper = party.role === 'DEVELOPER';
  return NextResponse.json({
    id: qr.id,
    kind: qr.kind,
    title: conversationTitle(qr),
    viewerRole: party.role,
    otherParty: isDeveloper
      ? { name: qr.contractor.name, slug: qr.contractor.slug, logoUrl: qr.contractor.logoUrl }
      : { name: qr.developer.name, slug: null, logoUrl: null },
    quote:
      qr.kind === 'QUOTE'
        ? { projectType: qr.projectType, location: qr.location, budgetRangeLabel: qr.budgetRangeLabel, status: qr.status }
        : null,
    otherLastReadAt: isDeveloper ? qr.contractorLastReadAt : qr.developerLastReadAt,
  });
}
