// src/lib/quote-request-access.ts
//
// "Is the signed-in user one of the two parties to this quote request, and
// are they allowed to act on it right now?" Used by the message thread
// routes and the contractor status route. Previously lived inline in
// src/app/api/quote-requests/[id]/messages/route.ts; pulled out when the
// status route needed the exact same rule, because a second hand-copied
// version of the lead-cap check is exactly how one of the two ends up
// fixed and the other not.
//
// Returns null for "not a party", "doesn't exist" AND "contractor is over
// their lead cap for this request" alike, so callers can answer all three
// with the same 404. Don't confirm a quote request exists to someone who
// isn't part of it.
//
// LEAD-CAP ENFORCEMENT: a contractor only gets through if this specific
// QuoteRequest is currently fully-visible to them per
// computeLeadVisibility (src/lib/lead-limits.ts), the same check the
// dashboard uses to decide whether to blur a lead. This used to be UI-only:
// the button was hidden on blurred cards, but nothing stopped a LISTED
// contractor over their monthly cap from calling the API directly. The
// whole point of the cap is to withhold something valuable until upgrade,
// and a UI-only gate doesn't withhold it. Developers are never capped, so
// this only applies to the CONTRACTOR side.

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeLeadVisibility, getMonthStart } from '@/lib/lead-limits';
import { monthLeadsFor } from '@/lib/month-leads';

export type QuoteRequestParty = { role: 'DEVELOPER' | 'CONTRACTOR'; userId: string };

export async function getQuoteRequestParty(quoteRequestId: string): Promise<QuoteRequestParty | null> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  const userId = session?.user?.id as string | undefined;

  if (!userId || (role !== 'developer' && role !== 'contractor')) {
    return null;
  }

  const quoteRequest = await prisma.quoteRequest.findUnique({
    where: { id: quoteRequestId },
    select: { developerId: true, contractorId: true, createdAt: true },
  });
  if (!quoteRequest) return null;

  if (role === 'developer' && quoteRequest.developerId === userId) {
    return { role: 'DEVELOPER', userId };
  }

  if (role === 'contractor' && quoteRequest.contractorId === userId) {
    // Only relevant for LISTED contractors; PLUS/PRO are unlimited.
    const contractor = await prisma.contractor.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    if (!contractor) return null;

    if (contractor.tier === 'LISTED') {
      const monthStart = getMonthStart();
      const thisMonthRequests = await monthLeadsFor(userId, monthStart);
      const visibility = computeLeadVisibility(contractor.tier, thisMonthRequests);
      // A request from a PRIOR month was never subject to blurring, so it
      // short-circuits to allowed.
      //
      // Fails CLOSED, not open: if this request is in the current month
      // but visibility.get() somehow returns undefined instead of
      // 'full'/'blurred' (shouldn't happen, since thisMonthRequests is
      // queried by this exact contractor and date range), treat it as
      // blurred rather than silently granting access.
      const isCurrentMonth = quoteRequest.createdAt >= monthStart;
      const isBlurred = isCurrentMonth && visibility.get(quoteRequestId) !== 'full';
      if (isBlurred) return null;
    }

    return { role: 'CONTRACTOR', userId };
  }

  return null;
}

// Ids of this contractor's CURRENT-month leads (quote requests AND site visit
// requests) that are blurred for them
// (LISTED tier, over the monthly cap). Empty for PLUS/PRO. Used by list
// views (the Messages inbox, unread counts) that need the same answer as
// getQuoteRequestParty for many threads at once without a query each.
export async function blurredLeadIdsFor(contractorId: string): Promise<Set<string>> {
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { tier: true },
  });
  if (!contractor || contractor.tier !== 'LISTED') return new Set();
  const monthStart = getMonthStart();
  const thisMonth = await monthLeadsFor(contractorId, monthStart);
  const visibility = computeLeadVisibility(contractor.tier, thisMonth);
  return new Set(thisMonth.filter((r) => visibility.get(r.id) !== 'full').map((r) => r.id));
}

// Which of the given leads are LOCKED for this contractor right now (free plan,
// current month, not one of the first five). Fails CLOSED: a current-month lead
// that is missing from the month list counts as locked. Used by the site visit
// routes, which hold rows with their own dates.
export async function lockedLeadIdsAmong(
  contractorId: string,
  leads: { id: string; createdAt: Date }[]
): Promise<Set<string>> {
  if (leads.length === 0) return new Set();
  const contractor = await prisma.contractor.findUnique({ where: { id: contractorId }, select: { tier: true } });
  if (!contractor || contractor.tier !== 'LISTED') return new Set();
  const monthStart = getMonthStart();
  const visibility = computeLeadVisibility(contractor.tier, await monthLeadsFor(contractorId, monthStart));
  return new Set(leads.filter((l) => l.createdAt >= monthStart && visibility.get(l.id) !== 'full').map((l) => l.id));
}
