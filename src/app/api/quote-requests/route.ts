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
//
// EMAIL VERIFICATION GATE. Logging in does NOT require a verified email
// (see the Developer model comment in prisma/schema.prisma — that's still
// true), but sending a quote request does. A request puts the developer's
// email and phone in front of a real contractor and costs us an email
// send; letting an unverified (possibly fake or mistyped) address do that
// means contractors reply into the void, or someone signs up with a
// stranger's email and spams contractors under that name. Unverified
// developers get a 403 with code 'EMAIL_NOT_VERIFIED' and a human message
// pointing them at the resend link — the quote form on the contractor
// profile page shows the API's message as-is. The check runs after auth
// and BEFORE the rate limiter, so a blocked attempt doesn't also eat one
// of the developer's 20/hour.

import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendNewQuoteToContractorEmail, sendQuoteRequestEmail } from '@/lib/email';
import { sendPush } from '@/lib/push';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireVerifiedDeveloperEmail } from '@/lib/require-verified-email';

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

  // Before rate limiting — see file header ("EMAIL VERIFICATION GATE").
  const notVerified = await requireVerifiedDeveloperEmail(
    session.user.id,
    'Please verify your email before requesting quotes. Check your inbox for the verification link, or resend it from your dashboard.'
  );
  if (notVerified) return notVerified;

  // Rate limited per developer (not per IP) — this route is already behind
  // login, so the realistic abuse case is a logged-in account blasting
  // quote requests at many contractors, spamming their inboxes and
  // burning email-sending cost. 20/hour is generous for a genuine
  // developer shortlisting contractors, while still capping a scripted or
  // malicious burst.
  if (!(await checkRateLimit(`quote-request:${session.user.id}`, { maxAttempts: 20, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
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
    select: { id: true, name: true, email: true, passwordHash: true },
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

  // Also tell the contractor, by email (here) and in the app (the request
  // shows as "New" on their dashboard and counts toward the Nav badge; see
  // QuoteRequest.contractorSeenAt). Only contractors who have claimed their
  // account: an admin-entered placeholder has nobody to read it and often a
  // placeholder address. Sent after the response so it never slows the
  // developer down. The email carries no contact details (see the function
  // for why), so the free-plan lead cap still holds.
  if (contractor.passwordHash) {
    const baseUrl = process.env.NEXTAUTH_URL ?? '';
    after(() =>
      Promise.all([
        sendNewQuoteToContractorEmail({
          toEmail: contractor.email,
          contractorName: contractor.name,
          projectType,
          location,
          dashboardUrl: `${baseUrl}/contractor/dashboard`,
        }),
        // Same rule as the email: no developer details, so the lead cap holds.
        sendPush('CONTRACTOR', contractor.id, {
          title: 'New quote request',
          body: `${projectType} in ${location}`,
          url: '/contractor/dashboard',
          tag: `quote-${quoteRequest.id}`,
        }),
      ])
    );
  }

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
