// src/components/ProfileImage.tsx
//
// next/image for the contractor profile (logo, project gallery, lightbox),
// with one safety net: only URLs on a host next.config.ts lists under
// images.remotePatterns go through the image optimiser. Anything else is
// rendered `unoptimized` (a plain <img> with the same layout props).
//
// Why the fallback exists: project photos are locked to our own Vercel
// Blob store by src/lib/validate-image-url.ts, but the admin contractor
// route still accepts any URL for logoUrl (z.string().url()), and older
// rows may predate the Blob check. next/image throws on a host that isn't
// configured, which would take the whole profile page down over one bad
// logo. Degrading to an unoptimised image keeps the page up.
//
// KEEP IN SYNC with images.remotePatterns in next.config.ts. If a host is
// added there, add it here too, or it will just miss out on optimisation
// (nothing breaks).

import Image, { type ImageProps } from 'next/image';

const OPTIMISED_HOSTS: RegExp[] = [
  /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i,
  /^picsum\.photos$/i,
  /^fastly\.picsum\.photos$/i,
];

function canOptimise(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && OPTIMISED_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

export default function ProfileImage({ src, alt, ...rest }: Omit<ImageProps, 'src'> & { src: string }) {
  return <Image src={src} alt={alt} unoptimized={!canOptimise(src)} {...rest} />;
}
