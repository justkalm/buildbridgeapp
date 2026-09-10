// src/app/api/contractors/signup/route.ts
//
// Two cases, both handled here:
//
// 1. CLAIM: admin already entered this contractor by hand (email matches
//    an existing row with no passwordHash yet). Signing up sets their
//    password on that existing record instead of creating a duplicate —
//    this preserves whatever verification status, projects, etc. admin
//    already set up for them.
// 2. FRESH: no existing record with this email. Creates a brand new
//    Contractor row, starting at verificationStatus PENDING like any new
//    listing — nothing about self-signup skips the verification step.
//
// A contractor whose email matches an existing row that ALREADY has a
// passwordHash is rejected with a generic error, same reasoning as the
// developer signup route: don't confirm which emails already have active
// accounts.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email address').max(320),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
});

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
    // Deliberately generic — see file header comment.
    return NextResponse.json(
      { error: 'Could not create account with these details' },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const emailVerifyToken = crypto.randomBytes(32).toString('hex');
  const emailVerifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  let contractor;

  if (existing) {
    // CLAIM path — set credentials on the admin-entered row. Deliberately
    // does NOT touch verificationStatus, projects, or anything else admin
    // already configured.
    contractor = await prisma.contractor.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        emailVerifyToken,
        emailVerifyTokenExpiresAt,
      },
    });
  } else {
    // FRESH path — brand new contractor, self-registered. Starts at
    // PENDING verification like any new listing; a base slug derived from
    // the name, disambiguated if it collides.
    const baseSlug = slugify(name) || 'contractor';
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.contractor.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    contractor = await prisma.contractor.create({
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
  }

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
