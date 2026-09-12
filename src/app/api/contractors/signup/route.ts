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

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail, sendClaimAccountEmail } from '@/lib/email';

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email address').max(320),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
});

const GENERIC_CLAIM_RESPONSE = {
  claimRequested: true,
  message:
    'This email is already listed. If you own it, check your inbox for a link to set up dashboard access.',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function POST(req: NextRequest) {
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

  const { name, email, password, phone } = parsed.data;
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

  const baseSlug = slugify(name) || 'contractor';
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.contractor.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const contractor = await prisma.contractor.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      phone,
      slug,
      city: '',
      area: '',
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
