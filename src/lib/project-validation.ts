// src/lib/project-validation.ts
//
// Shared zod rule for the numeric fields on a completed Project (sq ft,
// floors, committed/actual duration in months), used by the contractor's
// own project routes and the admin add-contractor route. zod's default
// wording ("Too small: expected number to be >0") reads like an error in
// the site rather than a problem with what was typed, so this gives each
// field a plain-English message.
//
// There's deliberately no completed-year rule: the forms no longer ask for
// a completion year (the owner prefers the two durations). The
// Project.completedYear column still exists so older data isn't lost.

import { z } from 'zod';
import { isValidTradeType, isOtherSpeciality, MAX_OTHER_PER_CONTRACTOR } from '@/lib/trade-types';

export function positiveWhole(field: string) {
  return z
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .positive(`${field} must be more than 0`);
}

// ---------------------------------------------------------------------------
// Contractor profile field rules (team size, insurance cover), shared by the
// contractor self-service PATCH (/api/contractors/me) and the admin
// add-contractor route so the two can't drift apart. The matching forms
// import the same constants/helper for their inline checks.
// ---------------------------------------------------------------------------

// Upper bound on the largest team a profile can claim. Same ceiling the
// self-service route already used; the admin route had none.
export const MAX_TEAM_SIZE = 10000;

// Insurance cover is stored in ₹ lakh. 100,000 lakh = ₹10,000 crore, which is
// far beyond any cover a contractor in this market would actually hold (even
// large infrastructure firms carry a few hundred crore), yet low enough that
// a typo like an extra run of zeros gets bounced instead of being shown on
// a public profile as "₹ 5,000,000 crore".
export const MAX_INSURANCE_COVER_LAKH = 100000;

export const TEAM_SIZE_ORDER_MESSAGE = "Team size 'from' can't be more than 'to'";

export function teamSizeField(label: string) {
  return z
    .number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} can't be negative`)
    .max(MAX_TEAM_SIZE, `${label} can't be more than ${MAX_TEAM_SIZE.toLocaleString('en-IN')}`);
}

// 0 is allowed here because the self-service form has always allowed it and
// clears the field with null; the admin route keeps its own "must be more
// than 0" behaviour via `insuranceCoverLakhPositive`.
export function insuranceCoverLakhField() {
  return z
    .number({ error: 'Insurance cover must be a number' })
    .int('Insurance cover must be a whole number of lakh')
    .min(0, "Insurance cover can't be negative")
    .max(
      MAX_INSURANCE_COVER_LAKH,
      `Insurance cover can't be more than ${MAX_INSURANCE_COVER_LAKH.toLocaleString('en-IN')} lakh (₹10,000 crore). Check for extra zeros.`
    );
}

// Returns an error message when both bounds are known and 'from' > 'to',
// otherwise null. Callers pass the value that WILL be stored (incoming value,
// falling back to the stored one on a partial update).
export function teamSizeRangeError(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  if (typeof min === 'number' && typeof max === 'number' && min > max) {
    return TEAM_SIZE_ORDER_MESSAGE;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Contractor trades (KALM-167): the speciality values TradeTypePicker
// produces, shared by contractor signup, the self-service PATCH and the
// admin add-contractor route. Duplicates are dropped; at most
// MAX_OTHER_PER_CONTRACTOR typed-in ("Other") specialities.
// ---------------------------------------------------------------------------

export const MAX_SPECIALITIES = 80;

export function tradeTypesField() {
  return z
    .array(z.string().trim().min(1))
    .max(MAX_SPECIALITIES, `Pick up to ${MAX_SPECIALITIES} specialities`)
    .transform((values) => Array.from(new Set(values)))
    .refine((values) => values.every(isValidTradeType), {
      message: 'One or more specialities are not in the list. Please pick again.',
    })
    .refine((values) => values.filter(isOtherSpeciality).length <= MAX_OTHER_PER_CONTRACTOR, {
      message: `You can add up to ${MAX_OTHER_PER_CONTRACTOR} of your own specialities`,
    });
}
