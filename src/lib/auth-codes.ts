// src/lib/auth-codes.ts
//
// Error codes shared between the NextAuth config (src/lib/auth.ts, server
// only — it imports prisma and bcrypt) and the 'use client' login page.
// Lives in its own dependency-free file so the login page can import the
// exact string without dragging the server auth module into the browser
// bundle.
//
// These codes end up in a URL query param (NextAuth appends
// `?error=CredentialsSignin&code=<code>` to its redirect, and the client
// signIn() reads it back from there), so they must never carry anything
// sensitive or account-specific — fixed strings only.

/** authorize() refused the attempt because a login rate limit was hit. */
export const LOGIN_RATE_LIMITED_CODE = 'rate_limited';
