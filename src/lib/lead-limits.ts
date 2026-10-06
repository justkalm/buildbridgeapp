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

// "2026-10" for the India-time month a moment falls in (lead ledger, KALM-259).
export function istMonthKey(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Start (inclusive) and end (exclusive) of a "YYYY-MM" month in India time,
// or null when the text is not a real month.
export function getMonthRange(monthKey: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS),
  };
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

// ---------------------------------------------------------------------------
// What a contractor's dashboard is allowed to receive for each lead
// ---------------------------------------------------------------------------
// Pulled out of src/app/api/contractors/me/route.ts so the rule that actually
// protects a free contractor's missing contact details can be tested on its
// own. The blur has to happen on the server, in the data itself: a CSS blur
// alone would leave the real email and phone sitting in the JSON for anyone
// who opens the browser's network tab.

type LeadRowInput = {
  id: string;
  createdAt: Date;
  details: string;
  developer: { name: string; email: string | null; phone: string | null };
  // Never expected here (the dashboard query does not fetch it), but if a
  // future query ever does, a blurred row still must not carry it.
  contactPhone?: unknown;
  // Free text typed by the developer; masked on blurred rows when present.
  projectType?: string;
  location?: string;
};

export type LeadRowForContractor<T extends LeadRowInput> = Omit<T, 'developer' | 'details' | 'contactPhone'> & {
  details: string;
  developer: { name: string; email: string | null; phone: string | null };
  leadVisibility: LeadVisibility;
};

export const BLURRED_DETAILS_MAX_CHARS = 80;

// The short preview of a blurred lead's message (and the free-text project type
// and area) must not carry the way to reach the developer. Developers often
// type their number or email into free text ("call me on 98200 12345"), so
// email addresses and phone-like numbers are replaced before the text is cut.
//
// Phone-like = eight or more DIGITS, with at most two separator characters
// (space . - / or brackets) between digits, so "98200 12345", "98200/12345",
// "+91 98200 12345" and "(022) 2345 6789" are caught, while "1200 - 1500 sqft"
// (three characters between the groups), "1200-1500", "20000-25000" and plain
// dates are left alone.
// Digits in other scripts (Hindi, Marathi, Gujarati and so on) and hidden
// zero-width characters are normalised first. Emails are caught as
// "a@b.com", "a @ b . com", "a[at]b.com" and "a at b dot com".
//
// Done BEFORE cutting to 80 characters, so a number can never be sliced in
// half and leak its first digits. Shorter figures (14 floors, 25000 sq ft,
// 25,00,000) are untouched. This is a best effort on free text, not a
// guarantee: unusual spellings can still get through, which is why blurred
// leads also never carry the developer's email or phone fields at all.
const MASK = '••••';
// Hidden characters that can sit between digits to break up a number. The
// zero-width joiner (U+200D) is real punctuation inside Indic words, so it is
// only removed when it sits between two digits (see below).
const HIDDEN = /[\u200B\u200C\u2060\uFEFF\u00AD]/g;
const JOINER_BETWEEN_DIGITS = /(?<=\d)\u200D(?=\d)/g;
const NON_ASCII_DIGITS = /[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\uFF10-\uFF19]/g;
const DIGIT_ZEROES = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0xff10];
// A phone-like run: starts where no other number is running (lookbehind) and
// not at the start of a date (so "on 12/10/2026 9am" keeps its date).
const DATE = String.raw`(?:\d{1,2}[-./]\d{1,2}[-./]\d{2,4}|\d{4}[-./]\d{1,2}[-./]\d{1,2})(?!\d)`;
const PHONE_LIKE = new RegExp(String.raw`(?<!\d)(?!${DATE})\+?\d(?:[\s.\-/()]{0,2}\d){7,}`, 'g');
// Plain figures that look like a phone but are a range ("1200-1500", "area
// 2000/2500", "20000-25000"): two groups of 3 to 5 digits with one - or /.
// A real mobile written in two halves ("98200-12345": starts 6 to 9, ten
// digits) is still masked.
const RANGE_LIKE = /^\d{3,5}[-/]\d{3,5}$/;
const MOBILE_IN_TWO_HALVES = /^[6-9]\d{4}[-/]\d{5}$/;
// The (?<![\w.+-]) lookbehind keeps these linear on long runs of letters: a
// match can only start at the beginning of a word, not at every character.
const EMAIL_SYMBOL = /(?<![\w.+-])[\w.+-]+\s*(?:@|\[at\]|\(at\))\s*[\w-]+(?:\s*(?:\.|\[dot\]|\(dot\))\s*[\w-]+)+/gi;
const EMAIL_WORDS = /(?<![\w.+-])[\w.+-]+\s+at\s+[\w-]+(?:\s+dot\s+[\w-]+)+/gi;
const EMAIL_AT_WORD = /(?<![\w.+-])[\w.+-]+\s+at\s+[\w-]+(?:\.[\w-]+)+/gi;

export function maskContactDetails(text: string): string {
  const plain = text
    .replace(NON_ASCII_DIGITS, (ch) => {
      const code = ch.charCodeAt(0);
      const zero = DIGIT_ZEROES.find((z) => code >= z && code <= z + 9);
      return zero === undefined ? ch : String(code - zero);
    })
    .replace(HIDDEN, '')
    .replace(JOINER_BETWEEN_DIGITS, '')
    .replace(/\uFF20/g, '@');
  return plain
    .replace(EMAIL_SYMBOL, MASK)
    .replace(EMAIL_WORDS, MASK)
    .replace(EMAIL_AT_WORD, MASK)
    .replace(PHONE_LIKE, (run) => (RANGE_LIKE.test(run) && !MOBILE_IN_TWO_HALVES.test(run) ? run : MASK));
}

function cutPreview(text: string): string {
  return text.length > BLURRED_DETAILS_MAX_CHARS ? `${text.slice(0, BLURRED_DETAILS_MAX_CHARS)}…` : text;
}

/**
 * @param monthIdsOldestFirst EVERY request of the current month for this
 *   contractor, oldest first (ids only). Never a trimmed list: the free five
 *   are decided from the whole month.
 * @param rows the leads actually shown on the dashboard (may be fewer).
 *
 * Free (LISTED) plan: this month's first five leads stay full; the rest are
 * blurred (developer email and phone removed, details masked and cut to 80 characters;
 * the developer's name and the project basics stay, as on the dashboard).
 * Earlier months are never blurred. A current-month lead that is missing from
 * the month list is blurred, never shown (fails closed). Paid plans see all.
 */
export function applyLeadVisibility<T extends LeadRowInput>(
  tier: 'LISTED' | 'PLUS' | 'PRO',
  monthStart: Date,
  monthIdsOldestFirst: { id: string }[],
  rows: T[]
): LeadRowForContractor<T>[] {
  const visibilityById = computeLeadVisibility(tier, monthIdsOldestFirst);

  return rows.map((r) => {
    const visibility: LeadVisibility =
      visibilityById.get(r.id) ?? (tier === 'LISTED' && r.createdAt >= monthStart ? 'blurred' : 'full');

    if (visibility === 'full') {
      return { ...r, leadVisibility: 'full' as const };
    }

    const { developer, details, contactPhone: _contactPhone, ...rest } = r;
    return {
      ...rest,
      ...(typeof rest.projectType === 'string' ? { projectType: maskContactDetails(rest.projectType) } : {}),
      ...(typeof rest.location === 'string' ? { location: maskContactDetails(rest.location) } : {}),
      details: cutPreview(maskContactDetails(details)),
      developer: { name: developer.name, email: null, phone: null },
      leadVisibility: 'blurred' as const,
    } as LeadRowForContractor<T>;
  });
}

// ---------------------------------------------------------------------------
// One month list for every kind of lead
// ---------------------------------------------------------------------------
// A lead is a quote request (any kind) OR a site visit request. The free-plan
// cap counts them all in ONE list, oldest first, so the first five of the
// month are full whichever way they arrived. Ids are unique across both tables
// (cuids), so the list can be fed straight to computeLeadVisibility.
export function mergeMonthLeads(
  ...lists: { id: string; createdAt: Date }[][]
): { id: string; createdAt: Date }[] {
  return lists
    .flat()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// ---------------------------------------------------------------------------
// A site visit request, as a contractor may see it
// ---------------------------------------------------------------------------
// Same rule as a blurred quote request: the developer's NAME and the plain
// facts of the visit (sites, offered times) stay, the developer's email, phone
// and free-text note do not. The note is cut and masked like a message preview
// because developers type numbers into it. Locked visits cannot be answered
// (see src/app/api/site-visits/[id]/route.ts).
type VisitForContractor = {
  contactPhone: string | null;
  developerNote: string | null;
  developer: { name: string; email?: string | null };
};

export function applySiteVisitVisibility<T extends VisitForContractor>(
  locked: boolean,
  visit: T
): Omit<T, 'contactPhone' | 'developerNote' | 'developer'> & {
  contactPhone: string | null;
  developerNote: string | null;
  developer: { name: string; email?: string | null };
  locked: boolean;
} {
  if (!locked) return { ...visit, locked: false };
  const { developer, developerNote, contactPhone: _contactPhone, ...rest } = visit;
  return {
    ...rest,
    contactPhone: null,
    developerNote: developerNote ? cutPreview(maskContactDetails(developerNote)) : null,
    developer: { name: developer.name },
    locked: true,
  } as never;
}
