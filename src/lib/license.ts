// src/lib/license.ts
//
// Placeholder license numbers. Contractors who self-sign-up (as opposed to
// being added by an admin who has actually seen their license) get a
// generated `PENDING-<hex>` value in the licenseNumber column so the field
// stays populated and unique while they haven't given us a real license yet.
//
// A PENDING-* value now simply means "no licence number on file". Most
// contractors do not hold a licence, so a licence is an EXTRA check, not a
// condition of being Verified (owner decision, 14 Oct 2026). Verified still
// needs the three checks (documents, GSTIN, spoke to them). The placeholder
// is never shown to the public: the profile hides the licence row, and the
// admin sees "No licence on file". Keep the prefix and predicate here as the
// single source of truth other code should import.

export const PLACEHOLDER_LICENSE_PREFIX = 'PENDING-';

export function isPlaceholderLicense(licenseNumber: string | null | undefined): boolean {
  if (!licenseNumber) return false;
  return licenseNumber.startsWith(PLACEHOLDER_LICENSE_PREFIX);
}

// Demo contractors (prisma/seed-demo.ts) carry a DEMO/ licence number. They
// are shown with a "Demo profile" tag instead of the Verified badge, so
// nobody mistakes a made-up profile for a checked one.
export const DEMO_LICENSE_PREFIX = 'DEMO/';

export function isDemoLicense(licenseNumber: string | null | undefined): boolean {
  if (!licenseNumber) return false;
  return licenseNumber.startsWith(DEMO_LICENSE_PREFIX);
}
