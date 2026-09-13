// src/app/api/admin/upload/route.ts
//
// Accepts a single image file, uploads it to Vercel Blob, and returns the
// resulting URL. Gated by admin auth — same reasoning as every other
// /api/admin route: this writes real data (and costs real storage), so it
// shouldn't be reachable by anyone who hasn't authenticated.
//
// Deliberately restrictive on what it accepts:
// - Images only (jpeg, png, webp) — this is for contractor logos and
//   project photos, not a general file-upload endpoint.
// - 5MB max — generous for a logo or a project photo, but caps how much
//   storage and bandwidth a single upload can consume.
// - Content is verified against its actual magic bytes, not just the
//   client-reported file.type — see src/lib/verify-image.ts for why
//   trusting that header alone isn't enough.

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { verifyImageFileType } from '@/lib/verify-image';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Keyed by IP, not a per-user id — the shared admin session has no
  // individual user identity to key on (see admin-auth.ts). Lower urgency
  // than the contractor-facing upload route since only whoever has the
  // admin password+2FA can reach this at all, but consistent protection
  // is simple to add and costs nothing.
  const ip = getClientIp(req);
  if (!checkRateLimit(`admin-upload:${ip}`, { maxAttempts: 30, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json(
      { error: 'Too many uploads. Please try again later.' },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, or WebP images are allowed' },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'Image must be under 5MB' },
      { status: 400 }
    );
  }

  if (!(await verifyImageFileType(file, file.type))) {
    return NextResponse.json(
      { error: 'File content does not match a valid image of the declared type' },
      { status: 400 }
    );
  }

  try {
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Failed to upload to Vercel Blob:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}