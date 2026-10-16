// src/app/api/join/upload/route.ts
//
// Photo upload for the no-login onboarding form at /join (logo and project
// photos). Same checks as src/app/api/contractors/upload/route.ts (JPEG,
// PNG or WebP only, 5MB cap, file content must match the declared type),
// but nobody is signed in here, so the limits do the protecting instead:
//
//   - per IP: 60 uploads an hour. One contractor with 10 projects and a few
//     photos each fits; a script does not get far.
//   - whole site: 600 uploads a day across everyone. Uploads cost real Blob
//     storage, and a spread-out attack (many IPs) would slip under the
//     per-IP limit, so this caps the worst case. If a busy onboarding day
//     ever hits it, raise the number here.
//
// The returned URL only becomes part of an application when /api/join
// accepts it (which checks it is on our own Blob store). A photo uploaded
// and never sent stays as an orphan file, same trade-off as ImageUpload's
// header comment describes.

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { verifyImageFileType } from '@/lib/verify-image';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isSameOrigin } from '@/lib/same-origin';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const HOUR = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  // The form is on our own page, so a real upload always comes from it.
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const ip = getClientIp(req);
  if (!(await checkRateLimit(`join-upload:${ip}`, { maxAttempts: 60, windowMs: HOUR }))) {
    return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429 });
  }
  if (!(await checkRateLimit('join-upload:all', { maxAttempts: 600, windowMs: 24 * HOUR }))) {
    return NextResponse.json(
      { error: 'Uploads are paused for today. Please send your photos to us on WhatsApp instead.' },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 });
  }

  if (!(await verifyImageFileType(file, file.type))) {
    return NextResponse.json(
      { error: 'File content does not match a valid image of the declared type' },
      { status: 400 }
    );
  }

  try {
    // Our own file name, not the sender's: the folder keeps these apart
    // from listing photos, and nothing typed by a stranger ends up in a URL.
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const blob = await put(`join/photo.${ext}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Failed to upload to Vercel Blob:', err);
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 });
  }
}
