// src/lib/password-rules.ts
//
// The client-safe half of the password policy: just the numbers and the
// one line of helper text the signup / reset-password pages show under
// the password field. Split out from src/lib/password-policy.ts on
// purpose — that file pulls in zod and a few-hundred-entry common-password
// list, neither of which any 'use client' page needs to ship to the
// browser just to render `minLength={10}`. Keeping the constant here (and
// importing it in both places) is what stops the page's hint and the
// server's actual rule from drifting apart the way "8" had to be hunted
// down in seven files.

// 10, not 8: at 8 characters the realistic human-chosen space (a word + a
// year + a symbol) is small enough that an offline attack against a
// leaked bcrypt hash is practical for the weakest ones; two more
// characters costs a real user almost nothing. The common-password check
// in password-policy.ts does most of the heavy lifting — length alone
// doesn't stop "password@123".
export const PASSWORD_MIN_LENGTH = 10;

// Upper bound exists because bcrypt only looks at the first 72 bytes and
// because hashing a multi-megabyte "password" is a cheap way to burn CPU.
// 200 is well past anything a password manager generates by default.
export const PASSWORD_MAX_LENGTH = 200;

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters. Avoid common passwords like “password@123”.`;
