// src/components/ShortlistButton.tsx
//
// Save/unsave toggle for a contractor. Only meaningful for a logged-in
// developer — a contractor viewing another contractor's profile, or a
// logged-out visitor, sees nothing here rather than a button that would
// just 401 on click. This mirrors the pattern used elsewhere in the app
// (e.g. Nav hides "Post a Project" from non-developers) rather than
// showing every control to everyone and handling the failure after the
// fact.
//
// Deliberately does NOT fetch the developer's whole shortlist just to
// determine one button's state — that would mean every browse card
// firing its own redundant check, or the parent page having to fetch and
// thread shortlist state down to N cards. Instead this takes
// `initiallySaved` as a prop (the parent, which already has the
// developer's shortlist loaded where relevant, passes it in) and manages
// optimistic toggling locally from there. On pages that don't have that
// context (a fresh page load on /browse with no shortlist fetch), pass
// `initiallySaved={false}` — the button will still work correctly, it
// just won't show as already-saved until the developer's real shortlist
// state is known some other way (e.g. after they save something in this
// session).

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function ShortlistButton({
  contractorId,
  initiallySaved = false,
  className,
}: {
  contractorId: string;
  initiallySaved?: boolean;
  className?: string;
}) {
  const { status, data: session } = useSession();
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, setPending] = useState(false);

  const isDeveloper = status === 'authenticated' && (session?.user as { role?: string })?.role === 'developer';

  if (!isDeveloper) {
    return null;
  }

  async function toggle(e: React.MouseEvent) {
    // Buttons like this sit inside clickable card links (browse cards
    // link to the profile page) — without stopping propagation, clicking
    // "save" would also navigate away via the parent link.
    e.preventDefault();
    e.stopPropagation();

    if (pending) return;
    setPending(true);

    const wasSaved = saved;
    setSaved(!wasSaved); // optimistic

    try {
      if (wasSaved) {
        const res = await fetch(`/api/developers/shortlist/${contractorId}`, { method: 'DELETE' });
        if (!res.ok) setSaved(wasSaved); // roll back
      } else {
        const res = await fetch('/api/developers/shortlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractorId }),
        });
        if (!res.ok) setSaved(wasSaved); // roll back
      }
    } catch {
      setSaved(wasSaved); // roll back
    }
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from shortlist' : 'Save to shortlist'}
      className={
        className ??
        `text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60 ${
          saved ? 'bg-ink text-paper border-ink' : 'border-line text-stone hover:border-ink'
        }`
      }
    >
      {saved ? '✓ Saved' : '+ Save'}
    </button>
  );
}
