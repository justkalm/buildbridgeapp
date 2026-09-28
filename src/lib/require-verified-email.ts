// src/lib/require-verified-email.ts
//
// Shared "must have a verified email to do this" gate for developer
// actions that reach other people — currently POST /api/quote-requests
// and POST /api/project-posts. Login itself is deliberately NOT gated on
// verification (see the Developer model comment in prisma/schema.prisma
// and the verify-email route): an unverified developer can still sign in,
// browse, shortlist, and find the "resend verification" button on their
// dashboard. Only actions that hand their contact details to a contractor
// or admin, and trigger an email on their behalf, require it.
//
// Returns a ready-to-send 403 response when blocked, or null when the
// caller may proceed. The response always carries
// `code: 'EMAIL_NOT_VERIFIED'` so a client can branch on it (e.g. show a
// resend button inline) without string-matching the human message, which
// each route words for its own action.
//
// ON/OFF SWITCH: only enforced when the environment variable
// REQUIRE_EMAIL_VERIFICATION is exactly "true". Off by default, because
// until a real domain is verified in Resend the site can only email the
// Resend account owner. Every other developer would be unable to receive a
// verification link and would be locked out of quotes, project posts and
// site visits. Turn it on (in Vercel's environment variables, then
// redeploy) once the domain is verified and verification emails actually
// arrive.
//
// Reads emailVerified from the DB rather than the session: the JWT is
// minted at login and would stay stale after the user clicks the link,
// forcing a sign-out/in before they could act. One small indexed lookup
// by primary key is cheap for routes that are about to write a row and
// send an email anyway.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED';

export function isEmailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
}

export async function requireVerifiedDeveloperEmail(
  developerId: string,
  message: string
): Promise<NextResponse | null> {
  if (!isEmailVerificationRequired()) return null;

  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
    select: { emailVerified: true },
  });

  // A missing row is left for the calling route to handle with its own
  // "Account not found" 401 — this helper only answers the verification
  // question, and a deleted account isn't a verification problem.
  if (!developer || developer.emailVerified) return null;

  return NextResponse.json({ error: message, code: EMAIL_NOT_VERIFIED_CODE }, { status: 403 });
}
