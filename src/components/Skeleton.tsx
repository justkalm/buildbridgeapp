// src/components/Skeleton.tsx
//
// Grey placeholder shapes shown while a page's data loads, in place of a
// bare "Loading…" line. The page keeps its layout while it waits, so it
// feels faster and nothing jumps around when the real content arrives.
//
// Deliberately tiny: one <Skeleton> block you size with classes
// (e.g. <Skeleton className="h-4 w-40" />), composed into page-specific
// placeholder layouts where they're used. Hidden from screen readers;
// callers should put role="status" and a visually hidden "Loading…" label
// on the surrounding placeholder so assistive tech still hears that
// something is loading. The pulse stops for anyone who prefers reduced
// motion (globals.css sets animation durations to ~0 in that case).

export default function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[4px] bg-paper-dim ${className}`} />;
}
