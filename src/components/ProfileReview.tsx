// src/components/ProfileReview.tsx
//
// One project's review, as shown on the contractor profile's project card
// and in the project lightbox: stars, the quoted text, and a small
// "Review collected by (kalm) from …" caption.
//
// Why the caption (KALM-072): reviews are entered by (kalm) after talking
// to the developer, not typed in by the contractor. Saying so, and saying
// who it came from, is what makes a review worth trusting on a
// marketplace where the listed party could otherwise be suspected of
// writing its own. Falls back to "the client" when the project has no
// developer name on record.

import ProfileStars from '@/components/ProfileStars';

export default function ProfileReview({
  rating,
  text,
  developerName,
  size = 'sm',
}: {
  rating: number;
  text: string | null;
  developerName: string | null;
  // 'sm' for the project card, 'md' for the roomier lightbox panel.
  size?: 'sm' | 'md';
}) {
  const md = size === 'md';
  return (
    <div>
      <p className={`${md ? 'text-base' : 'text-sm'} mb-1`}>
        <ProfileStars rating={rating} className="text-sage" emptyClassName="text-line" emptyGlyph="★" />
      </p>
      {text && <p className={`${md ? 'text-sm' : 'text-xs'} text-stone italic`}>&quot;{text}&quot;</p>}
      <p className={`${md ? 'text-xs' : 'text-[11px]'} text-stone mt-1.5`}>
        Review collected by (kalm) from {developerName?.trim() || 'the client'}
      </p>
    </div>
  );
}
