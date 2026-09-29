// src/components/BrowseLogo.tsx
//
// A contractor's logo on a /browse card, or their initials when there is
// no logo. Uses next/image (KALM-065) rather than a bare <img>, so the
// 56px square is served as a small, compressed, modern-format file
// instead of the full-size upload. Only works for hosts allowed in
// next.config.ts (Vercel Blob uploads, plus picsum for the demo seed);
// uploads are already restricted to Blob (src/lib/validate-image-url.ts).
//
// Falls back to initials if the image fails to load (a deleted Blob file,
// say), not just when there's no logoUrl, so a broken image icon never
// shows. The failure is tracked per URL so a changed logoUrl gets a fresh
// attempt. The alt text is empty because the contractor's name sits right
// next to the logo on the card: announcing "<name> logo" before "<name>"
// only repeated it.

'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function BrowseLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!logoUrl && failedUrl !== logoUrl;

  return (
    <div className="w-14 h-14 rounded-lg bg-ink text-paper font-display text-lg flex items-center justify-center shrink-0 overflow-hidden">
      {showImage ? (
        <Image
          src={logoUrl}
          alt=""
          width={56}
          height={56}
          className="w-full h-full object-cover"
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
