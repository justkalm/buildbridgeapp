// src/lib/location.ts
//
// One shared rule for how a contractor's city and area are written, so the
// browse filters don't end up offering "thane", "Thane" and "THANE " as
// three different places. Applied in three spots:
//   - server-side when saving (admin add-contractor, contractor profile
//     PATCH): the real guarantee, whichever form the value came from;
//   - client-side when the input loses focus, so the person typing sees
//     the tidied version before they save;
//   - on /browse when building the filter options, so rows saved before
//     this rule existed still group together.
//
// The rule: trim, collapse repeated spaces, then capitalise the first
// letter of each word and lowercase the rest ("andheri west" → "Andheri
// West", "navi-mumbai" → "Navi-Mumbai"). Short all-caps words (2–4
// letters) are kept as typed, since they're usually abbreviations like
// "CBD Belapur" or "MIDC". The exception: if the WHOLE input is in capitals
// (caps lock left on), every word is title-cased, abbreviations included.
// Safe to run on an already-normalized value: it returns it unchanged.
//
// Same-place spellings (Bombay is Mumbai) are folded into one, so the
// filters, saved rows and search treat them as a single place. Only a WHOLE
// value is matched, so "New Bombay" and "Bombay Central" are left alone.
const SAME_PLACE: Record<string, string> = { bombay: 'Mumbai' };

// Pure function, no imports, so both server routes and client components
// can use it.

export function normalizeLocation(input: string): string {
  const collapsed = input.trim().replace(/\s+/g, ' ');
  if (!collapsed) return collapsed;

  const hasLower = /[a-z]/.test(collapsed);
  const allCaps = !hasLower && /[A-Z]/.test(collapsed);

  const sameAs = SAME_PLACE[collapsed.toLowerCase()];
  if (sameAs) return sameAs;

  // Split on separators but keep them, so "Navi-Mumbai (East)" keeps its
  // hyphen, space and brackets exactly where they were.
  return collapsed
    .split(/([\s\-/(),.]+)/)
    .map((part) => {
      if (!/[A-Za-z]/.test(part)) return part;
      const isAbbreviation = !allCaps && /^[A-Z]{2,4}$/.test(part);
      if (isAbbreviation) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

// "Area, City" for display, coping with either part being blank. Signup
// now requires both, but contractors who self-signed-up before that have
// an empty city and area until they fill in their profile, and showing
// a bare ", " for them looks broken.
export function formatLocation(area: string, city: string): string {
  const parts = [area.trim(), city.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Location not set';
}
