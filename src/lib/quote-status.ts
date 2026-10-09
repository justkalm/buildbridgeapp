// src/lib/quote-status.ts
//
// The one place that decides which QuoteRequest status changes are
// allowed, and how each status is worded to each side. Both the API route
// (which enforces the rules) and the two dashboards (which only offer the
// buttons the rules allow) read from here, so the UI can never offer a
// move the server would reject, and the wording can't drift between the
// developer's view and the contractor's.
//
// Moves go forward, plus one way back: Undo returns any answered request
// to New (PENDING). It exists for mis-taps (owner's call, 10 Oct 2026).
// The developer is told about an undo the same way as any other change, so
// they are never left holding an email that is no longer true. Undo goes
// back to New rather than to the previous status because the previous
// status isn't stored; the contractor just taps the right button again.

export type QuoteStatus = 'PENDING' | 'CONTACTED' | 'QUOTED' | 'DECLINED';

export const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  PENDING: ['CONTACTED', 'QUOTED', 'DECLINED'],
  CONTACTED: ['QUOTED', 'DECLINED', 'PENDING'],
  QUOTED: ['PENDING'],
  DECLINED: ['PENDING'],
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

// Label on the Undo button (a move back to PENDING).
export const contractorUndoLabel = 'Undo';

// How the current status reads to the developer, on their dashboard and in
// the status-change email. CONTACTED is worded "Contractor is in touch"
// (not "Accepted", which read like a promise to do the job; owner's call,
// 10 Oct 2026). The enum value itself kept its old name; see the
// QuoteRequestStatus comment in schema.prisma.
export const developerStatusLabel: Record<QuoteStatus, string> = {
  PENDING: 'Awaiting response',
  CONTACTED: 'Contractor is in touch',
  QUOTED: 'Quote sent',
  DECLINED: 'Declined',
};

// What the developer is told when a contractor undoes an earlier update.
export const developerUndoNotice = 'Earlier update withdrawn, awaiting response';
