// src/app/api/join/route.ts
//
// Receives the no-login contractor onboarding form at /join (16 Oct 2026)
// and saves it as a ContractorApplication for admin to read at
// /admin/applications. It never creates a Contractor, an account or
// anything public: a person checks every one and adds the listing by hand.
//
// No sign-in, so the limits protect it: 15 sends an hour per IP (a whole
// meeting room on one Wi-Fi shares an IP, so not lower), and 100 a day
// across the whole site (a spread-out flood can fill admin's list but not
// without end). Both are counted only after the fields pass, so a typo
// doesn't use up a try. Rules for every field live in src/lib/join-form.ts.
// The admin email is best effort: a failed email is logged (Failed emails
// tab) and the form still counts as sent, because the row is already saved.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isSameOrigin } from '@/lib/same-origin';
import { joinFormSchema } from '@/lib/join-form';
import { sendContractorApplicationEmail } from '@/lib/email';
import { SITE_URL } from '@/lib/site';

const HOUR = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = joinFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const ip = getClientIp(req);
  if (!(await checkRateLimit(`join-form:${ip}`, { maxAttempts: 15, windowMs: HOUR }))) {
    return NextResponse.json({ error: 'Too many forms sent. Please try again later.' }, { status: 429 });
  }
  if (!(await checkRateLimit('join-form:all', { maxAttempts: 100, windowMs: 24 * HOUR }))) {
    return NextResponse.json(
      { error: 'We have had a lot of forms today. Please try again tomorrow or message us on WhatsApp.' },
      { status: 429 }
    );
  }

  const data = parsed.data;
  await prisma.contractorApplication.create({
    data: {
      businessName: data.businessName,
      phone: data.phone,
      email: data.email,
      area: data.area,
      bio: data.bio ?? null,
      logoUrl: data.logoUrl ?? null,
      tradeTypes: data.tradeTypes,
      gstNumber: data.gstNumber ?? null,
      licenceNumber: data.licenceNumber ?? null,
      hasInsurance: data.hasInsurance,
      projects: data.projects.map((p) => ({
        name: p.name,
        ...(p.developerName ? { developerName: p.developerName } : {}),
        imageUrls: p.imageUrls,
      })),
      consentAt: new Date(),
    },
  });

  await sendContractorApplicationEmail({
    businessName: data.businessName,
    area: data.area,
    tradeCount: data.tradeTypes.length,
    projectCount: data.projects.length,
    adminUrl: `${SITE_URL}/admin/applications`,
  });

  return NextResponse.json({ ok: true });
}
