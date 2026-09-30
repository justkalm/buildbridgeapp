// src/components/AlertsStrip.tsx
//
// One slim line at the top of both dashboards that replaces the separate
// "Turn on notifications" (PushPrompt) and "Add to home screen"
// (InstallAppPrompt) cards there. The owner found the two cards plus the
// dashboard lists too much scrolling on a phone (1 Oct 2026), so only the
// single most useful next step is shown, in this order:
//
//   1. iPhone not on the Home Screen: "Add (kalm) to your Home Screen to
//      get alerts" (iOS only allows notifications for Home Screen web apps).
//   2. Notifications off: "Get alerts for new enquiries" + Turn on.
//   3. Notifications blocked in browser settings: says so, once.
//   4. Alerts on, Android phone that can install: "Install app".
//   Otherwise (alerts on and nothing to install, desktop, no support,
//   non-https dev address) it shows nothing.
//
// "Not now" uses the same per-device dismiss flags as the full cards, so
// dismissing here also quiets them on the Messages page and vice versa.
// The Messages inbox keeps the full PushPrompt as the one place to switch
// alerts on or off.

'use client';

import { useEffect, useState } from 'react';
import { enablePush, getPushState, syncPush, type PushState } from '@/lib/push-client';
import { PUSH_DISMISS_KEY } from '@/components/PushPrompt';
import { INSTALL_DISMISS_KEY, isPhoneOrTablet, isStandalone, type InstallEvent } from '@/components/InstallAppPrompt';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function setFlag(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Storage blocked: it just shows again next time.
  }
}

export default function AlertsStrip({ audience }: { audience: 'contractor' | 'developer' }) {
  const [push, setPush] = useState<PushState | null>(null);
  const [pushDismissed, setPushDismissed] = useState(true);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPushState().then((s) => {
      if (cancelled) return;
      if (s === 'on') syncPush();
      setPushDismissed(readFlag(PUSH_DISMISS_KEY));
      setInstallDismissed(readFlag(INSTALL_DISMISS_KEY));
      setPush(s);
    });
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (push === null) return null;

  const what = audience === 'contractor' ? 'new enquiries and messages' : 'replies and site visit updates';

  let text: string | null = null;
  let action: { label: string; run: () => void } | null = null;
  let dismissKey: string | null = null;

  if (push === 'ios-needs-install' && !pushDismissed) {
    text = `Get alerts for ${what}: tap Share, then "Add to Home Screen", and open (kalm) from there.`;
    dismissKey = PUSH_DISMISS_KEY;
  } else if (push === 'off' && !pushDismissed) {
    text = `🔔 Get alerts for ${what}, even when (kalm) is closed.`;
    action = { label: busy ? 'Turning on…' : 'Turn on', run: turnOn };
    dismissKey = PUSH_DISMISS_KEY;
  } else if (push === 'denied' && !pushDismissed) {
    text = 'Alerts are blocked for this site. Allow notifications in your browser settings to get them.';
    dismissKey = PUSH_DISMISS_KEY;
  } else if (installEvent && !installDismissed && !isStandalone() && isPhoneOrTablet()) {
    text = 'Add (kalm) to your home screen to open it like an app.';
    action = { label: 'Install app', run: install };
    dismissKey = INSTALL_DISMISS_KEY;
  }

  if (!text || !dismissKey) return null;

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      setPush(await enablePush());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on alerts.");
    }
    setBusy(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  function notNow() {
    if (!dismissKey) return;
    setFlag(dismissKey);
    if (dismissKey === PUSH_DISMISS_KEY) setPushDismissed(true);
    else setInstallDismissed(true);
  }

  return (
    <div className="mb-5 px-3.5 py-2.5 rounded-[6px] border border-line bg-paper-dim flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <p className="text-[13px] text-ink min-w-0 flex-1">
        {text}
        {error && <span className="block text-xs text-danger mt-0.5">{error}</span>}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        {action && (
          <button
            type="button"
            onClick={action.run}
            disabled={busy}
            className="text-xs font-medium px-3.5 py-1.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors disabled:opacity-60"
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          onClick={notNow}
          className="text-xs text-stone underline underline-offset-2 hover:text-ink px-1"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
