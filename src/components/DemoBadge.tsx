// src/components/DemoBadge.tsx
//
// Shown instead of the Verified pill on made-up demo profiles (licence
// number starts with DEMO/, see src/lib/license.ts), on Browse cards and
// the profile page.

export default function DemoBadge() {
  return (
    <span
      className="inline-flex items-center text-[11px] text-stone bg-paper-dim border border-line rounded-full px-2.5 py-1"
      title="A sample profile used for testing. Not a real contractor."
    >
      Demo profile
    </span>
  );
}
