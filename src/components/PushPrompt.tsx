// src/components/PushPrompt.tsx
//
// "Turn on notifications" card, shown at the top of the Messages inbox and
// on both dashboards. Lets a developer or contractor get a phone/browser
// notification for new messages, quote requests, status changes and site
// visits even when (kalm) isn't open (see src/lib/push.ts).
//
// Two modes:
//   - default (dashboards): a prompt that only shows when there's something
//     to do. Hidden once notifications are on, and hidden on this device
//     once someone taps "Not now" (localStorage), so it doesn't nag.
//   - `persistent` (the Messages inbox): always shows the current state
//     with an On/Off control, whatever was dismissed, so there's always one
//     place to switch notifications on or off.
// When notifications can't work it says why rather than disappearing:
// blocked in browser settings, an iPhone that hasn't added (kalm) to the
// Home Screen (iOS only allows notifications for Home Screen web apps), or
// a non-https address. Only browsers with no notification support at all
// show nothing.

'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, getPushState, syncPush, type PushState } from '@/lib/push-client';

export const PUSH_DISMISS_KEY = 'kalm-push-prompt-dismissed';
const DISMISS_KEY = PUSH_DISMISS_KEY;

export default function PushPrompt({ persistent = false }: { persistent?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPushState().then((s) => {
      if (cancelled) return;
      // Make sure the server actually has this device (see syncPush).
      if (s === 'on') syncPush();
      let wasDismissed = false;
      try {
        wasDismissed = localStorage.getItem(DISMISS_KEY) === '1';
      } catch {
        // Storage blocked: just show the prompt.
      }
      setDismissed(wasDismissed);
      setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === null || state === 'unsupported') return null;
  if (!persistent && (state === 'on' || dismissed)) return null;

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      setState(await enablePush());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on notifications.");
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setState(await disablePush());
    setBusy(false);
  }

  function notNow() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div className="mb-6 px-4 py-3.5 rounded-[6px] border border-line bg-paper flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {state === 'on' ? 'Notifications are on for this device' : 'Get notified on this device'}
        </p>
        <p className="text-xs text-stone mt-0.5">
          {state === 'insecure'
            ? 'Notifications only work on the secure (https) site. On the live site this will switch on normally.'
            : state === 'ios-needs-install'
            ? 'On iPhone, notifications work once (kalm) is on your Home Screen: tap Share, then "Add to Home Screen", and open it from there.'
            : state === 'denied'
              ? 'Notifications are blocked for this site. Allow them in your browser settings to turn them on.'
              : state === 'on'
                ? 'New messages, quote requests and site visit updates will pop up here.'
                : 'A pop-up for new messages, quote requests and site visit updates, even when (kalm) is closed.'}
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
            {busy ? 'Turning on…' : 'Turn on notifications'}
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
        {state !== 'on' && !persistent && (
          <button onClick={notNow} className="text-xs text-stone underline underline-offset-2 hover:text-ink px-1">
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
