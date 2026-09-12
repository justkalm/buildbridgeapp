// src/app/api/quote-requests/route.ts
//
// The core mechanic of this slice: a developer requests a quote from a
// contractor, and that fires a notification email.
//
// Failure handling is deliberate here: the QuoteRequest row is written
// FIRST, before attempting the email. If the email send fails, the request
// is still recorded (developer's intent isn't lost) but `emailSentAt` stays
// null — that's your signal, checkable in the database, that a request
// didn't actually notify anyone. The API still returns success to the
// developer in that case, since their request WAS received; silently
// telling them it failed when their data was in fact saved would be its
// own kind of wrong. This tradeoff is worth revisiting once there's a
// dashboard for you to see emailSentAt failures — for now, check it
// directly in the database if requests seem to be going unanswered.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendQuoteRequestEmail } from '@/lib/email';

const quoteRequestSchema = z.object({
  contractorId: z.string().min(1),
  projectType: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  budgetRangeLabel: z.string().trim().min(1).max(100),
  details: z.string().trim().min(1).max(2000),
  contactPhone: z.string().trim().min(6).max(20),
});

export async function POST(req: NextRequest) {
  const session = await auth();

  // Explicit role check, not just "is someone logged in". Before this,
  // the check below (looking up a Developer row by session.user.id) would
  // incidentally reject a contractor's session too, since contractor and
  // developer IDs live in separate tables — but that was true by
  // coincidence, not by design. A future refactor that shared an ID space
  // between the two tables could silently reopen this. Checking the role
  // directly makes the intent explicit regardless of how IDs happen to be
  // generated.
  if (!session?.user?.id || (session.user as { role?: string }).role !== 'developer') {
    return NextResponse.json({ error: 'You must be signed in to request a quote' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { contractorId, projectType, location, budgetRangeLabel, details, contactPhone } = parsed.data;

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { id: true, name: true },
  });

  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  const developer = await prisma.developer.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  if (!developer) {
    // Session refers to a developer that no longer exists in the DB —
    // shouldn't normally happen, but fail clearly rather than proceeding
    // with missing data.
    return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  }

  // Write the request FIRST — see file header comment on why this ordering
  // matters.
  const quoteRequest = await prisma.quoteRequest.create({
    data: {
      contractorId,
      developerId: session.user.id,
      projectType,
      location,
      budgetRangeLabel,
      details,
      contactPhone,
    },
  });

  const emailSent = await sendQuoteRequestEmail({
    contractorName: contractor.name,
    developerName: developer.name,
    developerEmail: developer.email,
    contactPhone,
    projectType,
    location,
    budgetRangeLabel,
    details,
  });

  if (emailSent) {
    await prisma.quoteRequest.update({
      where: { id: quoteRequest.id },
      data: { emailSentAt: new Date() },
    });
  }

  return NextResponse.json({
    id: quoteRequest.id,
    emailSent,
  });
}
