// src/app/api/contractors/signup/route.ts
//
// Two cases, handled very differently:
//
// 1. FRESH: no existing contractor with this email. Creates a brand new
//    row immediately, password included in this same request — there's no
//    takeover risk here, since nobody already owns that email on the
//    platform.
//
// 2. CLAIM: admin already entered this contractor by hand (email matches
//    an existing row with no passwordHash yet). This does NOT set a
//    password in this request. It emails a claim link to the address on
//    file and returns a generic "check your email" response instead.
//
//    This used to accept a password directly in the same request as the
//    email — which meant anyone who knew or guessed an existing
//    contractor's business email (often public: a website, a business
//    card, a GST filing) could set a password and take over that
//    contractor's verified listing without ever proving they controlled
//    the inbox. Splitting this into "request a claim link" + "set
//    password via that link" (POST /api/contractors/reset-password,
//    reusing the same token mechanism) closes that: only whoever can read
//    the email that admin already has on file can ever set the password.
//
// A contractor whose email matches an existing row that ALREADY has a
// passwordHash is rejected with a generic error either way — don't
// confirm which emails already have active accounts.
//
// Password rules come from src/lib/password-policy.ts (shared with the
// developer routes). On the CLAIM path the submitted password is still
// validated but then discarded — the real one is set via the emailed link,
// where the same policy applies again.
//
// City and area are required on every signup (normalized via
// src/lib/location.ts, same rule as the admin add-contractor route), for
// the same reason the password is: the form can't know in advance whether
// this email is a FRESH signup or a CLAIM, so it always asks for them.
//   - FRESH: saved as the contractor's location. They used to be saved as
//     '' and filled in later from the profile page, which left new
//     listings unfindable by the /browse location filters in the meantime
//     and gave admin nothing to check when verifying.
//   - CLAIM: validated, then ignored, like the password. Admin entered this
//     contractor's location by hand when creating the listing, and this
//     request hasn't proven inbox ownership yet (that's the whole point of
//     the claim link), so letting it rewrite the listing's location would
//     reopen a smaller version of the takeover hole described above. Once
//     they've claimed the account they can change it from their profile.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail, sendClaimAccountEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { newPasswordSchema, refinePasswordNotEmail } from '@/lib/password-policy';
import { normalizeLocation } from '@/lib/location';
import { uniqueContractorSlug } from '@/lib/slugify';

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email address').max(320),
  // Length, common-password and not-your-email rules all live in
  // src/lib/password-policy.ts — shared with both reset-password routes.
  password: newPasswordSchema,
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
  // Required on both paths but only saved on FRESH; see file header.
  city: z.string().trim().min(1, 'City is required').max(100).transform(normalizeLocation),
  area: z.string().trim().min(1, 'Area is required').max(100).transform(normalizeLocation),
}).superRefine(refinePasswordNotEmail);

const GENERIC_CLAIM_RESPONSE = {
  claimRequested: true,
  message:
    'This email is already listed. If you own it, check your inbox for a link to set up dashboard access.',
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`contractor-signup:${ip}`, { maxAttempts: 5, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const { name, email, password, phone, city, area } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.contractor.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing && existing.passwordHash) {
    // Already claimed — deliberately generic, see file header comment.
    return NextResponse.json(
      { error: 'Could not create account with these details' },
      { status: 400 }
    );
  }

  if (existing) {
    // CLAIM path — no password is set here. Email a claim link instead;
    // the password only gets set once that link is actually clicked (via
    // the existing reset-password flow), which proves inbox ownership.
    // city/area from the form are deliberately NOT written here: the
    // admin-entered location stays as it is (see file header).
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.contractor.update({
      where: { id: existing.id },
      data: { passwordResetToken, passwordResetTokenExpiresAt },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? '';
    await sendClaimAccountEmail({
      toEmail: existing.email,
      toName: existing.name,
      claimUrl: `${baseUrl}/reset-password?token=${passwordResetToken}&role=contractor`,
    });

    // Same generic response whether or not the email actually matched, in
    // spirit — but since we already branched on `existing` above to reach
    // here, this response is specifically the claim-requested case. The
    // unauthenticated caller can't distinguish "email matched, link sent"
    // from "email matched but something else stopped it" — either way,
    // the actionable answer for them is "check your email."
    return NextResponse.json(GENERIC_CLAIM_RESPONSE);
  }

  // FRESH path — brand new contractor, self-registered, password set
  // immediately since no takeover risk applies. Starts at PENDING
  // verification like any new listing; a base slug derived from the name,
  // disambiguated if it collides.
  const passwordHash = await bcrypt.hash(password, 12);
  const emailVerifyToken = crypto.randomBytes(32).toString('hex');
  const emailVerifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  // Shared with the admin create route (src/lib/slugify.ts): never empty,
  // collision-safe.
  const slug = await uniqueContractorSlug(name, prisma);

  const contractor = await prisma.contractor.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      phone,
      slug,
      city,
      area,
      tradeTypes: [],
      licenseNumber: `PENDING-${crypto.randomBytes(6).toString('hex')}`,
      emailVerifyToken,
      emailVerifyTokenExpiresAt,
    },
  });

  // Signup succeeds regardless of whether this send works — see developer
  // signup route for the same reasoning.
  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  await sendVerificationEmail({
    toEmail: contractor.email,
    toName: contractor.name,
    verifyUrl: `${baseUrl}/verify-email?token=${emailVerifyToken}&role=contractor`,
  });

  return NextResponse.json({ id: contractor.id, name: contractor.name, email: contractor.email });
}
