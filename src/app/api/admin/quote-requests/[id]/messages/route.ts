// src/app/api/admin/quote-requests/[id]/messages/route.ts
//
// Returns the actual message CONTENT for one specific thread. This is
// separate from admin/messages (the analytics route) on purpose: reading
// what two people actually said to each other is a real privacy step up
// from seeing that a conversation happened, and it should require
// deliberately opening one specific thread — not be bundled into a list
// or dashboard that surfaces content passively. The admin UI that calls
// this should reflect that too (an explicit "view conversation" action on
// one thread, not message previews inline in a table).
//
// Framed as dispute-resolution access, not routine monitoring — there's
// no code-level distinction that enforces that framing (admin auth is
// admin auth), but it's the intended use, and worth keeping true to in
// how this gets surfaced in the UI.

import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;

  const quoteRequest = await prisma.quoteRequest.findUnique({
    where: { id },
    select: {
      id: true,
      projectType: true,
      location: true,
      developer: { select: { name: true, email: true } },
      contractor: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, senderRole: true, body: true, createdAt: true },
      },
    },
  });

  if (!quoteRequest) {
    return NextResponse.json({ error: 'Quote request not found' }, { status: 404 });
  }

  return NextResponse.json(quoteRequest);
}
