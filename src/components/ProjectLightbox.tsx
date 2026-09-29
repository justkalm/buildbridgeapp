// src/components/ProjectLightbox.tsx
//
// Modal for browsing one project's photos at a larger size, with the
// project's details shown in a dedicated panel alongside — not a
// full-bleed fullscreen photo viewer. Image sits in a contained dark panel
// on the left; details (title, developer, type, size, floors, durations,
// and the review if there is one) sit in a light panel on the right, so
// the two aren't fighting for the same visual space the way a
// caption-over-photo layout does.
//
// Opened from the "Open project" button on a project card on the
// contractor profile page — see that page's `openProject` state.
//
// Keyboard (KALM-069): Escape closes, ←/→ navigate between photos, and
// Tab is kept inside the dialog while it's open. Focus moves to the close
// button when the dialog opens. Returning focus to the card that opened it
// is the PAGE's job (it owns the card buttons and does it in onClose),
// because clicking a button doesn't focus it in Safari, so "whatever was
// focused before" isn't reliable here. Click the backdrop (outside the
// modal card) to close, same as most lightboxes.
//
// Photo: next/image with `fill` + object-contain inside the image panel.
// `fill` needs a box with a real height, so the panel has one: a fixed
// 45vh strip on phones (details scroll below it), and on md+ the modal
// card is a fixed 80vh tall and the panel stretches to it. Previously the
// <img> set the height itself, which next/image with `fill` can't do.

'use client';

import { useEffect, useRef, useState } from 'react';
import ProfileImage from '@/components/ProfileImage';
import ProfileReview from '@/components/ProfileReview';

type ProjectLightboxProps = {
  project: {
    title: string;
    developerName: string | null;
    projectType: string | null;
    squareFeet: number | null;
    elevationFloors: number | null;
    committedDurationMonths: number | null;
    actualDurationMonths: number | null;
    imageUrls: string[];
    reviewRating?: number | null;
    reviewText?: string | null;
  };
  onClose: () => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ProjectLightbox({ project, onClose }: ProjectLightboxProps) {
  const [index, setIndex] = useState(0);
  const count = project.imageUrls.length;
  const hasMultiple = count > 1;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function goTo(newIndex: number) {
    setIndex((newIndex + count) % count);
  }

  // Move focus into the dialog once, when it opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (count > 1 && e.key === 'ArrowRight') setIndex((i) => (i + 1) % count);
      if (count > 1 && e.key === 'ArrowLeft') setIndex((i) => (i - 1 + count) % count);
      if (e.key === 'Tab' && dialogRef.current) {
        // Focus trap: wrap from last to first (and back with Shift) so Tab
        // can't wander onto the page behind the modal.
        const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [count, onClose]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const durationText = [
    project.committedDurationMonths && `Committed: ${project.committedDurationMonths} mo`,
    project.actualDurationMonths && `Actual: ${project.actualDurationMonths} mo`,
  ]
    .filter(Boolean)
    .join(' · ');

  const navBtnCls =
    'absolute top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 md:p-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-lightbox-title"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <span aria-hidden="true">×</span>
      </button>

      <div
        className="bg-paper rounded-lg overflow-hidden shadow-2xl w-full max-w-[1100px] max-h-[85vh] md:h-[80vh] flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image panel — contained, not full-bleed */}
        <div className="relative bg-ink shrink-0 h-[45vh] md:h-auto md:w-[62%]">
          {count > 0 ? (
            <ProfileImage
              src={project.imageUrls[index]}
              alt={hasMultiple ? `${project.title}, photo ${index + 1} of ${count}` : project.title}
              fill
              sizes="(min-width: 1100px) 700px, (min-width: 768px) 62vw, 100vw"
              className="object-contain"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-paper-dim to-line" />
          )}

          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(index - 1);
                }}
                aria-label="Previous photo"
                className={`${navBtnCls} left-3`}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(index + 1);
                }}
                aria-label="Next photo"
                className={`${navBtnCls} right-3`}
              >
                <span aria-hidden="true">›</span>
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {project.imageUrls.map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(i);
                    }}
                    aria-label={`Go to photo ${i + 1}`}
                    aria-current={i === index ? 'true' : undefined}
                    className={`w-1.5 h-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${i === index ? 'bg-white' : 'bg-white/35 hover:bg-white/60'}`}
                  />
                ))}
              </div>
              <span
                aria-hidden="true"
                className="absolute top-4 right-4 bg-black/50 text-white text-[11px] font-mono px-2 py-1 rounded-full"
              >
                {index + 1} / {count}
              </span>
            </>
          )}
        </div>

        {/* Details panel */}
        <div className="p-8 md:p-9 flex flex-col justify-center-safe min-h-0 overflow-y-auto md:w-[38%]">
          <h2 id="project-lightbox-title" className="font-display text-2xl text-ink mb-2">
            {project.title}
          </h2>

          {(project.developerName || project.projectType) && (
            <p className="text-stone text-sm mb-5">
              {[project.developerName && `Developer: ${project.developerName}`, project.projectType]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          <div className="flex flex-col gap-3.5 pt-5 border-t border-line">
            {project.squareFeet && (
              <DetailRow label="Built-up area" value={`${project.squareFeet.toLocaleString('en-IN')} sq ft`} />
            )}
            {project.elevationFloors && (
              <DetailRow label="Elevation" value={`G+${project.elevationFloors}`} />
            )}
            {durationText && <DetailRow label="Timeline" value={durationText} />}
          </div>

          {project.reviewRating ? (
            <div className="mt-5 pt-5 border-t border-line">
              <ProfileReview
                rating={project.reviewRating}
                text={project.reviewText ?? null}
                developerName={project.developerName}
                size="md"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-stone uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-ink text-right">{value}</span>
    </div>
  );
}
