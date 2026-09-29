// src/lib/slugify.ts
//
// ONE shared slug builder for contractors (admin create route + self signup).
// There used to be two local copies that disagreed: the admin one returned ""
// for names with no Latin letters (e.g. "शर्मा कंस्ट्रक्शन", emoji-only) and
// left leading/trailing/double hyphens in place, while signup fell back to a
// bare "contractor". An empty slug breaks the /contractors/[slug] URL and the
// unique constraint, so this guarantees a non-empty result.
//
// Rules: lowercase; anything outside a-z0-9 becomes a hyphen; runs of hyphens
// collapse; no leading/trailing hyphen; capped at MAX_SLUG_LENGTH. If nothing
// usable is left, the base is "contractor" plus a short random suffix so two
// different non-Latin names don't fight over the same fallback.

import { randomBytes } from 'crypto';

export const MAX_SLUG_LENGTH = 60;
const FALLBACK_BASE = 'contractor';

function randomSuffix(): string {
  return randomBytes(3).toString('hex'); // 6 hex chars
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return base || `${FALLBACK_BASE}-${randomSuffix()}`;
}

// Minimal structural type so this file doesn't import the Prisma client.
type SlugLookup = {
  contractor: {
    findUnique(args: { where: { slug: string }; select?: { id: true } }): Promise<unknown>;
  };
};

// Slug that is not currently taken: base, base-2, base-3, ... and after 50
// tries a random suffix. The lookup-then-create pattern can still race with a
// concurrent insert of the same name; the unique constraint remains the final
// guard, this just removes the common (sequential) collision.
export async function uniqueContractorSlug(name: string, prisma: SlugLookup): Promise<string> {
  const base = slugify(name);
  const taken = async (slug: string) =>
    !!(await prisma.contractor.findUnique({ where: { slug }, select: { id: true } }));

  if (!(await taken(base))) return base;
  for (let n = 2; n <= 50; n++) {
    // Leave room for the suffix inside the length cap.
    const candidate = `${base.slice(0, MAX_SLUG_LENGTH - 4).replace(/-+$/g, '')}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base.slice(0, MAX_SLUG_LENGTH - 7).replace(/-+$/g, '')}-${randomSuffix()}`;
}
