// src/components/ProjectGallery.tsx
//
// Shows all of a project's photos, not just the first one. Previously the
// contractor profile page hardcoded imageUrls[0], so any photos past the
// first were uploaded in admin but never actually seen by anyone. This
// renders in the same image slot as before (h-[100px]) with prev/next
// arrows and a dot counter when there's more than one photo — a single
// photo (or none) looks exactly like it did before.

'use client';

import { useState } from 'react';

export default function ProjectGallery({ imageUrls }: { imageUrls: string[] }) {
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

  return (
    <div className="relative h-[100px] w-full group">
      {/* eslint-disable-next-line @next/next/no-img-element -- external Blob URL */}
      <img src={imageUrls[index]} alt="" className="h-[100px] w-full object-cover" />

      {hasMultiple && (
        <>
          <button
            onClick={(e) => goTo(e, index - 1)}
            aria-label="Previous photo"
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ‹
          </button>
          <button
            onClick={(e) => goTo(e, index + 1)}
            aria-label="Next photo"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ›
          </button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {imageUrls.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
          <span className="absolute top-1.5 right-1.5 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono">
            {index + 1}/{imageUrls.length}
          </span>
        </>
      )}
    </div>
  );
}
