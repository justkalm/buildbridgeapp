// src/lib/admin-contractor-select.ts
//
// The set of Contractor fields safe to return to the admin UI. Used by
// every /api/admin/contractors* route that returns a Contractor (or list
// of them) so none of them accidentally leak passwordHash,
// emailVerifyToken, or passwordResetToken to the browser via a bare
// `include`/no-select findMany or update call.
//
// Kept as one shared constant rather than duplicated per-route specifically
// because duplication is how this kind of thing drifts — a field added
// here without updating a copy elsewhere silently reopens the gap this
// exists to close.

export const ADMIN_SAFE_CONTRACTOR_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  city: true,
  area: true,
  tradeTypes: true,
  licenseNumber: true,
  verificationStatus: true,
  verifiedAt: true,
  tier: true,
  yearsInBusiness: true,
  teamSizeMin: true,
  teamSizeMax: true,
  gstRegistered: true,
  insuranceCoverLakh: true,
  rating: true,
  reviewCount: true,
  phone: true,
  email: true,
  emailVerified: true,
  bio: true,
  dataSharingConsent: true,
  dataSharingConsentAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
