// src/lib/verify-image.ts
//
// Verifies a file is ACTUALLY the image type it claims to be, by checking
// its first few bytes (the "magic number") rather than trusting
// `file.type`, which is just a label the browser sends and is trivially
// spoofable by anyone sending the upload request directly (curl, a
// crafted fetch, Postman) instead of through the actual upload UI.
//
// Scope note: Vercel Blob already refuses to serve non-image-like content
// inline (it sets Content-Disposition: attachment for types it doesn't
// recognize as displayable, which prevents HTML from executing in a
// browser that opens the URL) — so the original concern here was never a
// full remote-code-execution risk. This check is still worth having as
// defense in depth: it stops mislabeled/malformed files from being stored
// as if they were valid images at all, which matters for anything that
// later assumes an uploaded "photo" is actually decodable image data
// (thumbnailing, format conversion, etc., if those are ever added).

const SIGNATURES: { mimeType: string; bytes: number[] }[] = [
  { mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP: "RIFF" .... "WEBP" — bytes 0-3 and 8-11, with an arbitrary
  // 4-byte size field in between, so this one can't be a single flat
  // prefix check the way JPEG/PNG can.
];

export async function verifyImageFileType(file: File, declaredType: string): Promise<boolean> {
  const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());

  if (declaredType === 'image/webp') {
    const isRiff =
      headerBytes[0] === 0x52 && headerBytes[1] === 0x49 && headerBytes[2] === 0x46 && headerBytes[3] === 0x46;
    const isWebp =
      headerBytes[8] === 0x57 && headerBytes[9] === 0x45 && headerBytes[10] === 0x42 && headerBytes[11] === 0x50;
    return isRiff && isWebp;
  }

  const signature = SIGNATURES.find((s) => s.mimeType === declaredType);
  if (!signature) return false; // declaredType wasn't jpeg or png either — reject

  return signature.bytes.every((byte, i) => headerBytes[i] === byte);
}
