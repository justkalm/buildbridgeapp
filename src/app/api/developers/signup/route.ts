// src/app/api/developers/signup/route.ts
//
// Creates a new Developer account. Password is hashed with bcrypt before
// storage. Returns a generic error on duplicate email rather than confirming
// "that email is already registered" — this is a small but standard
// precaution against using the signup endpoint to enumerate which emails
// already have accounts.
//
// Rate limited per IP: without this, a script could create unlimited fake
// accounts, spam this endpoint to burn database/email-sending cost, or use
// it to enumerate real emails via timing even with the generic error above.
// 5 signups per hour per IP is generous for real use (nobody creates more
// than a couple accounts) while still blocking casual scripted abuse.

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email address').max(320),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`developer-signup:${ip}`, { maxAttempts: 5, windowMs: 60 * 60 * 1000 })) {
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

  const { name, email, password, phone } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.developer.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    // Deliberately generic — see file header comment.
    return NextResponse.json(
      { error: 'Could not create account with these details' },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const emailVerifyToken = crypto.randomBytes(32).toString('hex');
  const emailVerifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const developer = await prisma.developer.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      phone,
      emailVerifyToken,
      emailVerifyTokenExpiresAt,
    },
  });

  // Signup succeeds regardless of whether this send works — a Resend
  // outage or misconfiguration shouldn't block account creation. Failures
  // are logged inside sendVerificationEmail itself.
  const baseUrl = process.env.NEXTAUTH_URL ?? '';
  await sendVerificationEmail({
    toEmail: developer.email,
    toName: developer.name,
    verifyUrl: `${baseUrl}/verify-email?token=${emailVerifyToken}`,
  });

  return NextResponse.json({ id: developer.id, name: developer.name, email: developer.email });
}
