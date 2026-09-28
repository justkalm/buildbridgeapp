// src/lib/site-visits.ts
//
// Shared rules and wording for site visits (see the SiteVisit model in
// prisma/schema.prisma for what a site visit is). The request form, the
// API routes and both dashboards all read from here, so the numbers the
// form enforces are exactly the numbers the server enforces, and both
// sides see the same status wording.
//
// Times are stored as UTC instants. They're entered in the developer's
// browser (datetime-local, i.e. their own clock, which for this market is
// IST) and always DISPLAYED in India time via formatVisitTime, including
// in emails, which are rendered on a server that runs in UTC. Showing a
// contractor "3:30 AM" for a 9 AM visit because the server's clock is UTC
// would be worse than useless.

export const SLOT_COUNT = 3;
export const MAX_SITES = 5;
export const PREFERRED_MIN_SITES = 3;

// The owner's rule is 3–5 sites per visit. A contractor who lists only one
// or two projects would otherwise be impossible to visit at all, so the
// minimum drops to "all of them" in that case.
export function minSitesFor(projectCount: number): number {
  return Math.min(PREFERRED_MIN_SITES, projectCount);
}

// Earliest/latest a proposed slot may be. 12 hours' notice gives a
// contractor a realistic chance to see the email and arrange site access;
// 90 days out is far enough for planning without letting requests sit
// around for a year.
export const MIN_NOTICE_MS = 12 * 60 * 60 * 1000;
export const MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

// How long a visit is assumed to last, for the calendar invite. Seeing
// several finished buildings, including travel between them, rarely takes
// less than a few hours.
export const VISIT_DURATION_MS = 3 * 60 * 60 * 1000;

export type SiteVisitStatus = 'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';

export const developerVisitStatusLabel: Record<SiteVisitStatus, string> = {
  REQUESTED: 'Waiting for contractor',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export const contractorVisitStatusLabel: Record<SiteVisitStatus, string> = {
  REQUESTED: 'New request',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

const INDIA_TIME = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

// e.g. "Sat, 4 Oct 2026, 10:30 am IST"
export function formatVisitTime(date: Date | string): string {
  return `${INDIA_TIME.format(new Date(date))} IST`;
}
