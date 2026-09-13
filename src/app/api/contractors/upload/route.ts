// src/app/api/contractors/upload/route.ts
//
// Mirrors src/app/api/admin/upload/route.ts exactly (same allowed types,
// same 5MB cap, same Vercel Blob upload), gated by contractor session
// instead of admin auth. A logged-in contractor can upload a photo for
// their own project — this route doesn't take a contractorId or projectId,
// it just uploads and returns a URL; associating that URL with a specific
// project happens client-side then gets saved via PATCH
// /api/contractors/me/projects, same pattern the admin form already uses.

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { verifyImageFileType } from '@/lib/verify-image';
import { checkRateLimit } from '@/lib/rate-limit';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== 'contractor') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Rate limited per contractor — uploads cost real storage/bandwidth on
  // Vercel Blob, and this route was previously uncapped: a logged-in
  // contractor could script unlimited uploads. 30/hour is generous for
  // genuine use (a handful of project photos at a time) while capping a
  // scripted burst.
  if (!checkRateLimit(`contractor-upload:${session.user.id}`, { maxAttempts: 30, windowMs: 60 * 60 * 1000 })) {
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
