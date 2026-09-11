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
};

export default function ImageUpload({
  label,
  value,
  onChange,
  onUploadStateChange,
  uploadUrl = '/api/admin/upload',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    onUploadStateChange?.(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Upload failed');
        return;
      }

      onChange(data.url);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-stone mb-1.5">{label}</label>

      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- external Blob URLs, not a local/optimizable asset */}
          <img src={value} alt="" className="w-16 h-16 rounded-md object-cover border border-line" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        </div>
      ) : (
        <div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            disabled={uploading}
            className="text-[13px] w-full text-stone file:mr-3 file:py-2 file:px-3 file:rounded-[4px] file:border file:border-line file:bg-paper file:text-[13px] file:font-medium disabled:opacity-50"
          />
          {uploading && <p className="text-xs text-stone mt-1">Uploading…</p>}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      )}
    </div>
  );
}
