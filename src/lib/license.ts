// src/lib/license.ts
//
// Placeholder license numbers. Contractors who self-sign-up (as opposed to
// being added by an admin who has actually seen their license) get a
// generated `PENDING-<hex>` value in the licenseNumber column so the field
// stays populated and unique while they haven't given us a real license yet.
//
// These placeholders must never be allowed to carry a VERIFIED status.
// "Verified" is supposed to mean (kalm) reviewed the real license, GST, and
// registration documents (see the badge copy on the homepage), and a
// PENDING-* value means there is no real license number on file to review.
// Both admin contractor routes (POST /api/admin/contractors and
// PATCH /api/admin/contractors/[id]) and the admin UI check this constant
// before allowing a VERIFIED status to be set, so keep the prefix and
// predicate here as the single source of truth other code should import.

export const PLACEHOLDER_LICENSE_PREFIX = 'PENDING-';

export function isPlaceholderLicense(licenseNumber: string | null | undefined): boolean {
  if (!licenseNumber) return false;
  return licenseNumber.startsWith(PLACEHOLDER_LICENSE_PREFIX);
}
