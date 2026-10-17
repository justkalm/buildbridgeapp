// src/lib/project-fields.ts
//
// The optional fields added to "Post a project" and "Request a quote" for
// the pilot (15 Oct 2026): built-up area in square feet, which trades are
// needed, and when the contractor is needed. Kept in one place so the forms,
// the API checks, the emails and the dashboards all agree.

// Far above any real building in Mumbai; stops absurd input.
export const MAX_BUILT_UP_AREA_SQFT = 10_000_000;

// "When do you need the contractor?" on Post a project. The stored value is
// the text shown, so old rows (null) simply show nothing.
export const NEEDED_BY_OPTIONS = [
  'Within 2 weeks',
  'Within a month',
  '1 to 3 months',
  'Still planning',
] as const;

export const MAX_TRADES_PER_POST = 12;

/** "30,000 sq ft" (Indian digit grouping), or null when no area was given. */
export function formatArea(sqft: number | null | undefined): string | null {
  return sqft && sqft > 0 ? `${Math.round(sqft).toLocaleString('en-IN')} sq ft` : null;
}

/** "Waterproofing, Tiling" for a post's trades; empty text when none. */
export function formatTrades(trades: readonly string[] | null | undefined): string {
  return trades && trades.length > 0 ? trades.join(', ') : '';
}

// A project "has enough photos" for the dashboard checklist at this many
// (17 Oct 2026): the /join form asks for one, and the checklist nudges
// contractors towards two or more, since projects with more photos get
// more enquiries.
export const WELL_PHOTOGRAPHED_MIN = 2;
