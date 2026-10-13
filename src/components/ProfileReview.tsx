// src/components/ProfileReview.tsx
//
// One project's review, as shown on the contractor profile's project card
// and in the project lightbox: the quoted words and a small "Review collected
// by (kalm) from ..." caption. Words only, no stars: with a handful of
// reviews per contractor a star score looks firmer than it is. (The 1 to 5
// score admin enters is kept in the database, private.)
//
// Why the caption (KALM-072): reviews are entered by (kalm) after talking
// to the developer, not typed in by the contractor. Saying so, and saying
// who it came from, is what makes a review worth trusting on a
// marketplace where the listed party could otherwise be suspected of
// writing its own. Falls back to "the client" when the project has no
// developer name on record.

export default function ProfileReview({
  text,
  developerName,
  size = 'sm',
}: {
  text: string;
  developerName: string | null;
  // 'sm' for the project card, 'md' for the roomier lightbox panel.
  size?: 'sm' | 'md';
}) {
  const md = size === 'md';
  return (
    <div>
      <p className={`${md ? 'text-sm' : 'text-xs'} text-stone italic`}>&quot;{text}&quot;</p>
      <p className={`${md ? 'text-xs' : 'text-[11px]'} text-stone mt-1.5`}>
        Review collected by (kalm) from {developerName?.trim() || 'the client'}
      </p>
    </div>
  );
}
