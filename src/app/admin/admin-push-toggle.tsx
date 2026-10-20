// src/app/admin/admin-push-toggle.tsx
//
// "Turn on alerts on this phone" on the admin home (20 Oct 2026). Puts this
// phone/browser on the admin alert list, so a confirmed sign-up, a join form
// or a project post pops up on it (sent by sendAdminPush in src/lib/push.ts).
// Each partner turns it on once on their own phone. On iPhone it only works
// once (kalm) is on the Home Screen, same as the developer/contractor
// notifications (src/components/PushPrompt.tsx, whose look this copies).

'use client';

import { useEffect, useState } from 'react';
import { adminPushIsOn, disableAdminPush, enableAdminPush, getPushState, type PushState } from '@/lib/push-client';

export default function AdminPushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const base = await getPushState();
      // The browser being subscribed (for personal notifications) doesn't
      // mean it's on the admin list, so ask the server.
      const s = base === 'on' || base === 'off' ? ((await adminPushIsOn()) ? 'on' : 'off') : base;
      if (!cancelled) setState(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === null || state === 'unsupported') return null;

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      setState(await enableAdminPush());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on alerts.");
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    await disableAdminPush();
    setState('off');
    setBusy(false);
  }

  return (
    <div className="mb-6 px-4 py-3.5 rounded-[6px] border border-line bg-white flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {state === 'on' ? 'Admin alerts are on for this device' : 'Admin alerts on this phone'}
        </p>
        <p className="text-xs text-stone mt-0.5">
          {state === 'insecure'
            ? 'Alerts only work on the secure (https) site.'
            : state === 'ios-needs-install'
              ? 'On iPhone, alerts work once (kalm) is on your Home Screen: tap Share, then "Add to Home Screen", open it from there and come back to /admin.'
              : state === 'denied'
                ? 'Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.'
                : state === 'on'
                  ? 'New sign-ups, join forms and project posts will pop up here.'
                  : 'A pop-up for every new sign-up, join form and project post, even when (kalm) is closed.'}
        </p>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        {state === 'off' && (
          <button
            onClick={turnOn}
            disabled={busy}
            className="text-xs font-medium px-4 py-2 rounded-full bg-ink text-paper hover:bg-stone transition-colors disabled:opacity-60"
          >
            {busy ? 'Turning on…' : 'Turn on alerts on this phone'}
          </button>
        )}
        {state === 'on' && (
          <button
            onClick={turnOff}
            disabled={busy}
            className="text-xs font-medium px-4 py-2 rounded-full border border-line text-stone hover:border-ink disabled:opacity-60"
          >
            Turn off
          </button>
        )}
      </div>
    </div>
  );
}
