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

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'kalm-cookie-consent-dismissed';

// The dismissed flag lives in localStorage, which only exists in the
// browser. Reading it during the first render (e.g. in a lazy useState
// initialiser) makes the server's HTML (no localStorage, banner hidden)
// disagree with the browser's first render (no stored flag, banner shown),
// which React reports as a hydration mismatch on every first visit.
// Setting state inside an effect avoids that but trips the repo's
// set-state-in-effect lint rule and renders twice.
//
// useSyncExternalStore is React's built-in answer: the server snapshot
// says "dismissed" (so the HTML never includes the banner), React uses
// that same value while hydrating, then switches to the real browser value
// straight after. Dismissing notifies subscribers so the banner hides.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Also pick up a dismissal made in another tab.
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // Storage blocked (private mode, strict settings): don't nag.
    return true;
  }
}

export default function CookieBanner() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Storage unavailable: the banner still hides for this page view below.
    }
    listeners.forEach((notify) => notify());
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
