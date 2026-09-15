// src/lib/lead-limits.ts
//
// Determines which of a contractor's quote requests they can see in full
// detail this month, vs. which are blurred behind an upgrade prompt.
//
// Only LISTED contractors have a cap — PLUS and PRO are unlimited. The cap
// resets on the calendar month (1st to 1st), not a rolling 30 days from
// signup — simpler to reason about, and matches how the eventual
// subscription billing will likely work once that's built.
//
// "Which 5 are free" is first-come-first-served WITHIN the month: the
// oldest N requests that month stay fully visible, anything after the Nth
// gets blurred. This mirrors how a real usage cap works (you don't retroactively
// blur something you already had access to just because five newer ones
// arrived) rather than always showing only the most recent 5.
//
// This only gates the QUOTE REQUEST count, not project alerts — those are
// already PRO-only by construction (see ProjectPostAlert schema comment),
// so they never count against or are affected by this cap.

const LISTED_MONTHLY_LEAD_CAP = 5;

// IST is UTC+5:30, fixed — India doesn't observe daylight saving, so this
// offset never changes and a simple constant is correct (no timezone
// library needed for this one calculation).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function getMonthStart(now: Date = new Date()): Date {
  // Previously used new Date(now.getFullYear(), now.getMonth(), 1), which
  // reads year/month from the SERVER's local timezone — UTC on Vercel.
  // That meant a request made around midnight IST (UTC+5:30) could be
  // dated to the wrong month by UTC's clock, for a ~5.5 hour window
  // around each month boundary — a lead sent at 1am IST on the 1st is
  // still Sept 30 in UTC, so it would count toward September's cap
  // instead of October's. Shifting `now` into IST before reading its
  // year/month fixes this: the boundary now actually falls at midnight
  // IST, matching where users actually are.
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - IST_OFFSET_MS);
}

export type LeadVisibility = 'full' | 'blurred';

/**
 * Given a contractor's tier and their quote requests for the CURRENT month
 * only (already filtered/sorted oldest-first by the caller), returns a
 * Map from quote request id to whether it should be shown in full or
 * blurred. Requests from PRIOR months are never blurred — the cap is
 * month-scoped, so history a contractor already had access to doesn't
 * retroactively lock.
 */
export function computeLeadVisibility(
  tier: 'LISTED' | 'PLUS' | 'PRO',
  thisMonthRequestsOldestFirst: { id: string }[]
): Map<string, LeadVisibility> {
  const visibility = new Map<string, LeadVisibility>();

  if (tier !== 'LISTED') {
    for (const r of thisMonthRequestsOldestFirst) {
      visibility.set(r.id, 'full');
    }
    return visibility;
  }

  thisMonthRequestsOldestFirst.forEach((r, index) => {
    visibility.set(r.id, index < LISTED_MONTHLY_LEAD_CAP ? 'full' : 'blurred');
  });

  return visibility;
}

export { LISTED_MONTHLY_LEAD_CAP };
