// src/app/api/contractors/[slug]/route.ts
//
// Returns one contractor with their project history, for the profile page.
// Note this does NOT return `phone` — a developer only gets the contractor's
// contact info released to them via a submitted quote request, matching the
// original product flow ("provide your number, they call you", not
// "browse everyone's number freely"). If a future feature needs to show
// phone numbers more openly, that's a deliberate product decision to make
// then, not a field to quietly add back here.
//
// Only returns VERIFIED contractors, same restriction as the browse
// listing in ../route.ts. This used to have no status filter at all —
// slugs are derived from business names (see the signup route's
// slugify()), so they're guessable/predictable, not secret; a PENDING or
// REJECTED contractor's full profile was reachable by anyone who guessed
// or found the slug, even though browse correctly hid them.
//
// The query itself lives in src/lib/public-contractor.ts, shared with the
// profile page (which now loads it on the server), so both always apply
// the same rules.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicContractor } from '@/lib/public-contractor';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const contractor = await getPublicContractor(slug);
  if (!contractor) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
  }

  return NextResponse.json(contractor);
}
