// src/components/ProfileSkeleton.tsx
//
// Loading placeholder for the contractor profile page
// (src/app/contractors/[slug]/page.tsx), shown while /api/contractors/[slug]
// is in flight. It mirrors the real page's shape (header with logo, name
// and meta line; two project cards; the sidebar box) so nothing jumps when
// the data arrives, instead of a lone "Loading…" in an empty page.
//
// The grey shapes are aria-hidden (see Skeleton.tsx); the wrapper is a
// role="status" region with a visually hidden "Loading…" so screen readers
// still hear that something is on its way. Nav and Footer are rendered by
// the page, not here. Container classes (max width, px-8, grid columns)
// deliberately match the real page; change both together.

import Skeleton from '@/components/Skeleton';

export default function ProfileSkeleton() {
  return (
    <div role="status" className="flex-1">
      <span className="sr-only">Loading…</span>

      <div className="bg-paper border-b border-line pt-11 pb-9">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 flex gap-5">
          <Skeleton className="w-[84px] h-[84px] rounded-xl shrink-0" />
          <div className="flex-1 flex flex-col gap-3 pt-1">
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-11 py-12">
        <div>
          <Skeleton className="h-4 w-full max-w-xl mb-2" />
          <Skeleton className="h-4 w-3/4 max-w-lg mb-8" />
          <Skeleton className="h-6 w-48 mb-5" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="border border-line rounded-md overflow-hidden bg-paper">
                <Skeleton className="h-[100px] w-full rounded-none" />
                <div className="p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-paper border border-line rounded-md p-6 h-fit flex flex-col gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
