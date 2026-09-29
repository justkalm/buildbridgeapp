// src/components/BrowseCardSkeleton.tsx
//
// Placeholder list shown on /browse while the contractor list loads, in
// place of the old bare "Loading contractors…" line (KALM-062). Each
// placeholder copies the real card's layout (logo square, name, location
// line, trade pills, stats row) so the page doesn't jump when the real
// cards arrive. Built from the shared <Skeleton> block; the wrapper is a
// role="status" region with visually hidden text so screen readers still
// hear that something is loading (the grey shapes themselves are hidden).

import Skeleton from '@/components/Skeleton';

export default function BrowseCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-40 mb-2" />
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-paper border border-line rounded-md p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <Skeleton className="h-5 w-48 max-w-[60%]" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
              <Skeleton className="h-4 w-56 max-w-[80%] mb-4" />
              <div className="flex gap-1.5 mb-4">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="flex gap-6">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
