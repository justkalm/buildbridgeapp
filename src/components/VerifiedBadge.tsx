// src/components/VerifiedBadge.tsx
//
// The public "Verified" pill, shared by Browse cards and the profile page
// so both always say the same thing.
//
// reviewPending: a Verified contractor changed a checked detail (location,
// phone, GST status or trades) and admin hasn't re-checked it yet. The
// owner's rule is that editing never takes a listing offline, so they stay
// Verified and listed, but the badge says "update in review" so it doesn't
// vouch for a detail nobody has checked. See reverifyPending in
// prisma/schema.prisma.

export default function VerifiedBadge({ reviewPending = false }: { reviewPending?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-sage bg-sage-soft border border-sage/25 rounded-full px-2.5 py-1"
      title={reviewPending ? 'Verified. A recent change to their details is being checked by (kalm).' : undefined}
    >
      <span aria-hidden="true">✓</span> Verified
      {reviewPending && <span className="text-stone">· update in review</span>}
    </span>
  );
}
