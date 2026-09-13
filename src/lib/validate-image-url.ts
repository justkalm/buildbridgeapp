// src/lib/validate-image-url.ts
//
// Restricts an image URL to the app's own Vercel Blob storage
// (https://<store-id>.public.blob.vercel-storage.com/...), rather than
// accepting any HTTPS URL. Used everywhere a contractor or admin submits
// imageUrls directly (project create/edit) — those fields used to accept
// z.string().url(), which is any valid URL on the internet, not just ones
// that actually came from this app's own upload flow. That meant someone
// could submit an external image URL (a tracking pixel, arbitrary/
// unmoderated image content) directly via the API, bypassing the upload
// endpoint's own file-type and size checks entirely, since those only
// apply to the actual upload request — not to a URL supplied afterward.
//
// This doesn't prove the URL was uploaded via THIS contractor's own
// upload call (that would need per-upload tracking this app doesn't have)
// — it only proves the URL points at the right storage provider, which is
// the meaningful boundary: it stops arbitrary external content, even if
// it doesn't stop one contractor referencing a URL from another
// contractor's earlier legitimate upload. That's an acceptable gap for
// now — the images are public anyway once uploaded, so referencing
// someone else's uploaded photo isn't a new exposure, just an odd (not
// harmful) thing to do.

const BLOB_HOSTNAME_PATTERN = /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/i;

export function isOwnBlobImageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return parsed.protocol === 'https:' && BLOB_HOSTNAME_PATTERN.test(parsed.hostname);
}
