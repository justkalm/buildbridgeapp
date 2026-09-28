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

export function positiveWhole(field: string) {
  return z
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .positive(`${field} must be more than 0`);
}
