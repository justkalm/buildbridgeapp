// src/lib/worked-with.ts
//
// "Worked with": the developers a contractor has built for, taken from the
// developerName that admin typed on each approved project (after cross-checking
// the project with that developer on a call). Shown on the browse card and the
// profile header.
//
// Never shown for demo contractors: their developer names are made up by the
// seed script, and a made-up "worked with" line next to a real-sounding
// developer would be a false claim.

// Distinct names in the order they first appear, trimmed, blanks dropped.
// Two names that differ only in capitals or spacing count as one.
export function workedWithNames(
  projects: { developerName: string | null }[],
  isDemo: boolean
): string[] {
  if (isDemo) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const p of projects) {
    const name = p.developerName?.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

// "A, B, C" for the first `limit` names, plus how many were left out.
export function workedWithSummary(names: string[], limit: number): { shown: string; more: number } {
  return { shown: names.slice(0, limit).join(', '), more: Math.max(0, names.length - limit) };
}
