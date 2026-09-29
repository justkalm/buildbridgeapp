// src/app/api/admin/contractors/route.ts
//
// Add (POST) or list (GET) contractors as admin. Gated by the shared admin
// password session — see src/lib/admin-auth.ts. This is what the admin
// add-contractor page submits to.
//
// GET here deliberately includes unverified contractors and all fields
// (including phone) — this is the admin's own view, not the public browse
// API, so the restrictions in src/app/api/contractors/route.ts don't apply.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { ADMIN_SAFE_CONTRACTOR_SELECT } from '@/lib/admin-contractor-select';
import { isOwnBlobImageUrl } from '@/lib/validate-image-url';
import { isValidTradeType } from '@/lib/trade-types';
import { isPlaceholderLicense } from '@/lib/license';
import { normalizeLocation } from '@/lib/location';
import {
  insuranceCoverLakhField,
  positiveWhole,
  teamSizeField,
  teamSizeRangeError,
} from '@/lib/project-validation';
import { uniqueContractorSlug } from '@/lib/slugify';

const projectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  developerName: z.string().trim().max(200).optional(),
  projectType: z.string().trim().max(200).optional(),
  squareFeet: positiveWhole('Sq ft').optional(),
  elevationFloors: positiveWhole('Floors').optional(),
  committedDurationMonths: positiveWhole('Committed duration').optional(),
  actualDurationMonths: positiveWhole('Actual duration').optional(),
  imageUrls: z
    .array(z.string().url())
    .max(10)
    .refine((urls) => urls.every(isOwnBlobImageUrl), {
      message: 'Image URLs must come from this app\'s own upload endpoint',
    })
    .default([]),
});

const contractorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  // Normalized to consistent capitalisation — see src/lib/location.ts.
  city: z.string().trim().min(1).max(100).transform(normalizeLocation),
  area: z.string().trim().min(1).max(100).transform(normalizeLocation),
  tradeTypes: z
    .array(z.string().trim().min(1))
    .min(1, 'At least one trade type is required')
    .refine((types) => types.every(isValidTradeType), {
      message: 'One or more trade types are not in the allowed list',
    }),
  licenseNumber: z.string().trim().min(1).max(100),
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).default('PENDING'),
  // Manual override only — not tied to billing. Trial period means no
  // contractor is actually paying yet; this exists so tier display and
  // sorting can be tested/used ahead of Razorpay integration.
  tier: z.enum(['LISTED', 'PLUS', 'PRO']).default('LISTED'),
  yearsInBusiness: z.number().int().min(0).max(150).optional(),
  teamSizeMin: teamSizeField('Team size').optional(),
  teamSizeMax: teamSizeField('Team size').optional(),
  gstRegistered: z.boolean().default(false),
  // Positive (admin has never allowed 0 here) and capped, see project-validation.ts.
  insuranceCoverLakh: insuranceCoverLakhField()
    .refine((n) => n > 0, 'Insurance cover must be more than 0')
    .optional(),
  phone: z.string().trim().min(6).max(20),
  // Required now — this becomes the contractor's dashboard login. The
  // admin form's UI-level `required` attribute doesn't stop a raw API
  // call, so it needs enforcing here too.
  email: z.string().trim().email('A valid email is required').toLowerCase(),
  bio: z.string().trim().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  projects: z.array(projectSchema).default([]),
});

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const contractors = await prisma.contractor.findMany({
    orderBy: { createdAt: 'desc' },
    // Explicit select (shared constant — see src/lib/admin-contractor-select.ts
    // for why this isn't a bare `include`), not `include` on a bare findMany —
    // that used to return the ENTIRE Contractor row, passwordHash and reset/
    // verify tokens included, to the admin's browser on every page load.
    // _count still needs its own explicit select alongside the shared
    // constant — the admin list page reads _count.projects and
    // _count.quoteRequests directly (both for display and for the delete
    // confirmation copy), and this got dropped once already when the bare
    // `include` was first replaced, which crashed the whole page render.
    select: { ...ADMIN_SAFE_CONTRACTOR_SELECT, _count: { select: { projects: true, quoteRequests: true } } },
  });

  return NextResponse.json(contractors);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = contractorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const rangeError = teamSizeRangeError(data.teamSizeMin, data.teamSizeMax);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }

  // A PENDING-* license number is a self-signup placeholder, not a real
  // license we've reviewed against the license, GST, and registration
  // documents, see src/lib/license.ts. Never let one be created already
  // marked Verified.
  if (data.verificationStatus === 'VERIFIED' && isPlaceholderLicense(data.licenseNumber)) {
    return NextResponse.json(
      {
        error:
          'This contractor has a placeholder license number (no real license on file) and cannot be marked Verified. Add the real license number first.',
      },
      { status: 400 }
    );
  }

  const existingLicense = await prisma.contractor.findUnique({
    where: { licenseNumber: data.licenseNumber },
  });
  if (existingLicense) {
    return NextResponse.json(
      { error: `A contractor with license number ${data.licenseNumber} already exists` },
      { status: 400 }
    );
  }

  // Shared slug builder: never empty for non-Latin names, and de-duplicated
  // (-2, -3...) so two same-named contractors no longer crash on the unique
  // constraint.
  const slug = await uniqueContractorSlug(data.name, prisma);

  const contractor = await prisma.contractor.create({
    data: {
      name: data.name,
      slug,
      city: data.city,
      area: data.area,
      tradeTypes: data.tradeTypes,
      licenseNumber: data.licenseNumber,
      verificationStatus: data.verificationStatus,
      verifiedAt: data.verificationStatus === 'VERIFIED' ? new Date() : null,
      tier: data.tier,
      yearsInBusiness: data.yearsInBusiness,
      teamSizeMin: data.teamSizeMin,
      teamSizeMax: data.teamSizeMax,
      gstRegistered: data.gstRegistered,
      insuranceCoverLakh: data.insuranceCoverLakh,
      phone: data.phone,
      email: data.email,
     bio: data.bio,
      logoUrl: data.logoUrl,
      projects: {
        create: data.projects.map((p) => ({
          title: p.title,
          developerName: p.developerName,
          projectType: p.projectType,
          squareFeet: p.squareFeet,
          elevationFloors: p.elevationFloors,
          committedDurationMonths: p.committedDurationMonths,
          actualDurationMonths: p.actualDurationMonths,
          imageUrls: p.imageUrls,
        })),
      },
    },
    select: { ...ADMIN_SAFE_CONTRACTOR_SELECT, projects: true },
  });

  return NextResponse.json(contractor);
}
