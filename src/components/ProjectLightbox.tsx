// src/components/ProjectLightbox.tsx
//
// Modal for browsing one project's photos at a larger size, with the
// project's details shown in a dedicated panel alongside — not a
// full-bleed fullscreen photo viewer. Image sits in a contained dark panel
// on the left; details (title, developer, type, size, floors, durations)
// sit in a light panel on the right, so the two aren't fighting for the
// same visual space the way a caption-over-photo layout does.
//
// Opened by clicking a project card on the contractor profile page — see
// that page's `openProject` state.
//
// Keyboard: Escape closes, ←/→ navigate between photos. Click the
// backdrop (outside the modal card) to close, same as most lightboxes.

'use client';

import { useEffect, useState } from 'react';

type ProjectLightboxProps = {
  project: {
    title: string;
    developerName: string | null;
    projectType: string | null;
    completedYear: number | null;
    squareFeet: number | null;
    elevationFloors: number | null;
    committedDurationMonths: number | null;
    actualDurationMonths: number | null;
    imageUrls: string[];
  };
  onClose: () => void;
};

export default function ProjectLightbox({ project, onClose }: ProjectLightboxProps) {
  const [index, setIndex] = useState(0);
  const hasMultiple = project.imageUrls.length > 1;

  function goTo(newIndex: number) {
    setIndex((newIndex + project.imageUrls.length) % project.imageUrls.length);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [index, onClose]);

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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 md:p-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${project.title} photos`}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
      >
        ×
      </button>

      <div
        className="bg-paper rounded-lg overflow-hidden shadow-2xl w-full max-w-[1100px] max-h-[85vh] flex flex-col md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image panel — contained, not full-bleed */}
        <div className="relative bg-ink md:w-[62%] shrink-0 flex items-center justify-center min-h-[280px] md:min-h-0">
          {project.imageUrls.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Blob URL
            <img
              src={project.imageUrls[index]}
              alt={`${project.title} photo ${index + 1}`}
              className="max-h-[50vh] md:max-h-[85vh] w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-paper-dim to-line" />
          )}

          {hasMultiple && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(index - 1);
                }}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(index + 1);
                }}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
              >
                ›
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {project.imageUrls.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      goTo(i);
                    }}
                    aria-label={`Go to photo ${i + 1}`}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/35 hover:bg-white/60'}`}
                  />
                ))}
              </div>
              <span className="absolute top-4 right-4 bg-black/50 text-white text-[11px] font-mono px-2 py-1 rounded-full">
                {index + 1} / {project.imageUrls.length}
              </span>
            </>
          )}
        </div>

        {/* Details panel */}
        <div className="p-8 md:p-9 flex flex-col justify-center overflow-y-auto md:w-[38%]">
          <h2 className="font-display text-2xl text-ink mb-2">{project.title}</h2>

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
            {project.completedYear && (
              <DetailRow label="Completed" value={String(project.completedYear)} />
            )}
            {durationText && <DetailRow label="Timeline" value={durationText} />}
          </div>
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
