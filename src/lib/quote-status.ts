// src/lib/quote-status.ts
//
// The one place that decides which QuoteRequest status changes are
// allowed, and how each status is worded to each side. Both the API route
// (which enforces the rules) and the two dashboards (which only offer the
// buttons the rules allow) read from here, so the UI can never offer a
// move the server would reject, and the wording can't drift between the
// developer's view and the contractor's.
//
// Moves are forward-only. A contractor can't un-decline or un-quote: the
// developer has already been emailed about each change, so walking one
// back would leave them with an email that's no longer true. If a
// contractor genuinely changes their mind, the in-app thread is the place
// to say so.

export type QuoteStatus = 'PENDING' | 'CONTACTED' | 'QUOTED' | 'DECLINED';

export const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  PENDING: ['CONTACTED', 'QUOTED', 'DECLINED'],
  CONTACTED: ['QUOTED', 'DECLINED'],
  QUOTED: [],
  DECLINED: [],
};

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

// Button text on the contractor's dashboard for moving TO each status.
// Plain words since KALM-175: in the persona review, a contractor read
// "Accept" as "I've won the job" and was afraid to tap the wrong button.
export const contractorActionLabel: Record<Exclude<QuoteStatus, 'PENDING'>, string> = {
  CONTACTED: 'Talking to them',
  QUOTED: 'Quote sent',
  DECLINED: 'Not interested',
};

// How the current status reads on the contractor's own dashboard.
export const contractorStatusLabel: Record<QuoteStatus, string> = {
  PENDING: 'New',
  CONTACTED: 'Talking to them',
  QUOTED: 'Quote sent',
  DECLINED: 'Not interested',
};

// How the current status reads to the developer, on their dashboard and in
// the status-change email. CONTACTED is worded as "Accepted" everywhere a
// person sees it — see the QuoteRequestStatus comment in schema.prisma for
// why the enum value itself kept its old name.
export const developerStatusLabel: Record<QuoteStatus, string> = {
  PENDING: 'Awaiting response',
  CONTACTED: 'Accepted: contractor will be in touch',
  QUOTED: 'Quote sent',
  DECLINED: 'Declined',
};
