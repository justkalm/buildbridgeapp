// src/components/ImageUpload.tsx
//
// A small, reusable upload control: pick a file, see a preview, get back a
// URL once it's uploaded. Used for both the contractor logo (single image)
// and project photos (used in an array, one instance per photo slot).
//
// Deliberately does the upload immediately on file selection rather than
// waiting for the parent form's submit — this means the image is already
// sitting in Vercel Blob by the time the contractor form is submitted, so
// the contractor-creation request itself stays small and fast (just a URL
// string, not raw file bytes riding along with everything else).
// Trade-off: an upload here that's never actually submitted (someone
// uploads a logo, then abandons the form) leaves an orphaned file in Blob
// storage — acceptable for this stage's low volume, worth revisiting with
// a cleanup job if upload volume grows later.

'use client';

import { useState } from 'react';
import Image from 'next/image';

type ImageUploadProps = {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  // Optional: lets a parent form know when this upload starts/finishes, so
  // it can disable its submit button while a photo is still mid-upload.
  // Without this, submitting while an upload is in flight silently drops
  // that photo — the form has no way to know to wait for it.
  onUploadStateChange?: (uploading: boolean) => void;
  // Which endpoint actually handles the upload. Defaults to the admin
  // route (original/only caller until the contractor dashboard needed its
  // own auth-gated equivalent) — pass '/api/contractors/upload' when using
  // this from a contractor-facing page so the request is checked against
  // contractor session instead of the admin cookie.
  uploadUrl?: string;
  // Redraw every photo in the browser before sending (used by the /join
  // form, which contractors fill in on their phones). Two reasons: Vercel
  // refuses request bodies over 4.5MB and many phone photos are bigger, and
  // redrawing drops the photo's hidden details (EXIF), which often include
  // the GPS position where it was taken. The files end up on public URLs.
  shrinkLargePhotos?: boolean;
  // Let several photos be picked in one go (the /join project photos).
  // Each one uploads in turn and is handed to onChange as soon as it is
  // done, so the parent adds them one by one. maxFiles caps how many are
  // taken from one pick (the photos still free on that project); any
  // extra are left out with a note saying so.
  multiple?: boolean;
  maxFiles?: number;
};

// Vercel's request body limit is 4.5MB; stay safely under it.
const MAX_SEND_BYTES = 4 * 1024 * 1024;
const MAX_SIDE_PX = 2000;

// Redraws the photo at most 2000px on its longest side: PNG stays PNG (a
// logo keeps its see-through parts), everything else becomes JPEG. Returns
// the original file only if the browser can't do it (then the size check
// below still gives a clear message).
async function shrinkPhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const asPng = file.type === 'image/png';
    const type = asPng ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
    if (!blob) return file;
    return new File([blob], asPng ? 'photo.png' : 'photo.jpg', { type });
  } catch {
    return file;
  }
}

export default function ImageUpload({
  label,
  value,
  onChange,
  onUploadStateChange,
  uploadUrl = '/api/admin/upload',
  shrinkLargePhotos = false,
  multiple = false,
  maxFiles,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  // "2 of 5" while a multi-photo pick is going up; null for a single photo.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Uploads one file; returns its URL, or the message to show.
  async function uploadOne(picked: File): Promise<{ url: string } | { error: string }> {
    const tooLarge = 'This photo is too large. Please pick a smaller one (under 4MB).';
    try {
      const file = shrinkLargePhotos ? await shrinkPhoto(picked) : picked;
      if (shrinkLargePhotos && file.size > MAX_SEND_BYTES) return { error: tooLarge };

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });
      if (res.status === 413) return { error: tooLarge };
      const data = await res.json().catch(() => ({}));

      if (!res.ok) return { error: data.error ?? 'Upload failed' };
      return { url: data.url };
    } catch {
      return { error: 'Upload failed. Please try again.' };
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const all = Array.from(e.target.files ?? []);
    const input = e.target;
    if (all.length === 0) return;
    const limit = multiple ? Math.max(1, maxFiles ?? all.length) : 1;
    const files = all.slice(0, limit);

    setError(null);
    setUploading(true);
    onUploadStateChange?.(true);
    if (multiple) setProgress({ done: 0, total: files.length });

    // One at a time on purpose: redrawing several big phone photos at once
    // can run a phone out of memory.
    let failed = 0;
    let lastError = '';
    for (let i = 0; i < files.length; i++) {
      const result = await uploadOne(files[i]);
      if ('url' in result) {
        onChange(result.url);
      } else {
        failed++;
        lastError = result.error;
      }
      if (multiple) setProgress({ done: i + 1, total: files.length });
    }

    const notes: string[] = [];
    if (failed > 0) {
      notes.push(files.length === 1 ? lastError : `${failed} of ${files.length} photos did not upload (${lastError})`);
    }
    if (all.length > files.length) {
      notes.push(`Only ${files.length} more ${files.length === 1 ? 'photo fits' : 'photos fit'}, so the other ${all.length - files.length} were left out.`);
    }
    setError(notes.length > 0 ? notes.join(' ') : null);

    setUploading(false);
    setProgress(null);
    onUploadStateChange?.(false);
    input.value = '';
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-stone mb-1.5">{label}</label>

      {value ? (
        <div className="flex items-center gap-3">
          {/* value is always a remote Vercel Blob URL (set from the upload
              response), which next.config.ts allows through the optimiser. */}
          <Image src={value} alt="" width={64} height={64} className="w-16 h-16 rounded-md object-cover border border-line" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-medium text-danger hover:text-danger"
          >
            Remove
          </button>
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={multiple}
            onChange={handleFileSelect}
            disabled={uploading}
            className="text-[13px] w-full text-stone file:mr-3 file:py-2 file:px-3 file:rounded-[4px] file:border file:border-line file:bg-paper file:text-[13px] file:font-medium disabled:opacity-50"
          />
          {uploading && (
            <p className="text-xs text-stone mt-1">
              {progress && progress.total > 1 ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…` : 'Uploading…'}
            </p>
          )}
          {error && <p className="text-xs text-danger mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
