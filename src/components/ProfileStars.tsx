// src/components/ProfileStars.tsx
//
// Star rating that screen readers can actually read. The ★/☆ glyphs are
// hidden from assistive tech (a screen reader would otherwise read out
// "black star, black star, black star, white star…"), and a visually
// hidden "Rated 4 out of 5" sentence says the same thing in words.
//
// Used for both the contractor's overall rating (a decimal average, shown
// to one decimal place) and a single project review (a whole number).
// The glyph styling differs between the two, so callers pass classes.

export default function ProfileStars({
  rating,
  className = '',
  emptyClassName = '',
  emptyGlyph = '☆',
}: {
  rating: number;
  className?: string;
  // Class for the unfilled stars, e.g. a lighter colour.
  emptyClassName?: string;
  // Project reviews draw empty stars as a pale ★; the header uses ☆.
  emptyGlyph?: string;
}) {
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  const spoken = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

  return (
    <span className={className}>
      <span aria-hidden="true">
        {'★'.repeat(filled)}
        <span className={emptyClassName}>{emptyGlyph.repeat(5 - filled)}</span>
      </span>
      <span className="sr-only">Rated {spoken} out of 5</span>
    </span>
  );
}
