// src/components/ProjectGallery.tsx
//
// Shows all of a project's photos, not just the first one. Previously the
// contractor profile page hardcoded imageUrls[0], so any photos past the
// first were uploaded in admin but never actually seen by anyone. This
// renders in the same image slot as before (h-[100px]) with prev/next
// arrows and a dot counter when there's more than one photo — a single
// photo (or none) looks exactly like it did before.
//
// Photos go through next/image (via ProfileImage, which falls back to an
// unoptimised image for hosts next.config.ts doesn't allow) using `fill`
// inside the fixed-height relative box, so the optimiser serves a
// card-sized file instead of the full upload. `sizes` follows the profile
// grid: one column on phones, two from md, and the main column tops out
// around 500px per card inside the 1440px container at lg.
//
// The card around this is not itself clickable any more: the page puts a
// "stretched" button on the card title whose ::after covers the whole card
// (see the profile page). The arrow buttons here therefore sit above that
// overlay with `z-10`, and stop propagation / default so a click on an
// arrow only changes the photo. They're also revealed on keyboard focus,
// not just hover, so a keyboard user can see what they've tabbed onto.

'use client';

import { useState } from 'react';
import ProfileImage from '@/components/ProfileImage';

const CARD_IMAGE_SIZES = '(min-width: 1024px) 500px, (min-width: 768px) 50vw, 100vw';

export default function ProjectGallery({
  imageUrls,
  projectTitle,
}: {
  imageUrls: string[];
  // Used for alt text — these are real project photos shown to a
  // developer browsing, not a self-referential upload preview (unlike the
  // admin/contractor "here's what you just uploaded" thumbnails elsewhere
  // in the app, where alt="" is the correct choice since there's nothing
  // distinguishing to announce). A developer deciding whether to hire this
  // contractor benefits from knowing which project each photo is from.
  projectTitle: string;
}) {
  const [index, setIndex] = useState(0);

  if (imageUrls.length === 0) {
    return <div className="h-[100px] bg-gradient-to-br from-paper-dim to-line" />;
  }

  const hasMultiple = imageUrls.length > 1;

  function goTo(e: React.MouseEvent, newIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    setIndex((newIndex + imageUrls.length) % imageUrls.length);
  }

  const arrowCls =
    'absolute z-10 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-opacity';

  return (
    <div className="relative h-[100px] w-full group">
      <ProfileImage
        src={imageUrls[index]}
        alt={hasMultiple ? `${projectTitle}, photo ${index + 1} of ${imageUrls.length}` : projectTitle}
        fill
        sizes={CARD_IMAGE_SIZES}
        className="object-cover"
      />

      {hasMultiple && (
        <>
          <button type="button" onClick={(e) => goTo(e, index - 1)} aria-label="Previous photo" className={`${arrowCls} left-1`}>
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" onClick={(e) => goTo(e, index + 1)} aria-label="Next photo" className={`${arrowCls} right-1`}>
            <span aria-hidden="true">›</span>
          </button>
          <div aria-hidden="true" className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {imageUrls.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono"
          >
            {index + 1}/{imageUrls.length}
          </span>
        </>
      )}
    </div>
  );
}
