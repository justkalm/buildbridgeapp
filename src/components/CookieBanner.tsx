// src/components/CookieBanner.tsx
//
// Simple cookie-consent notice. This is the "necessary cookies only,
// informational banner" pattern — not a full granular consent manager
// with category toggles (analytics/marketing/etc.), since the app doesn't
// currently set any cookies beyond what's required for the site to
// function (auth session cookies). If tracking/analytics cookies are ever
// added, this needs to become a real opt-in/opt-out mechanism, not just a
// dismissible notice — a notice-only banner is only appropriate for
// strictly-necessary cookies.
//
// Persisted via localStorage rather than a cookie itself (slightly ironic
// but deliberate: no need to round-trip this preference to the server,
// and it avoids setting yet another cookie just to remember "don't show
// the cookie banner again").

'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'kalm-cookie-consent-dismissed';

export default function CookieBanner() {
  const [dismissed, setDismissed] = useState(true); // default true avoids a flash before the localStorage check runs

  useEffect(() => {
    const alreadyDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setDismissed(alreadyDismissed);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-ink text-paper px-6 py-4">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-paper/90">
          We use cookies necessary for the site to work, like keeping you signed in. See our{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-paper">
            privacy policy
          </a>{' '}
          for details.
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 text-sm px-4 py-2 rounded-full bg-paper text-ink font-medium hover:bg-paper/90 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
