// src/components/InstallAppPrompt.tsx
//
// "Add (kalm) to your home screen" card for everyone on a phone, so
// (kalm) opens like an app with its own icon (src/app/manifest.ts) and is
// one tap away when a notification or email says something happened.
//
//   - Android (Chrome, Edge, Samsung Internet): the browser fires
//     `beforeinstallprompt`; we hold onto it and show an "Install app"
//     button that opens the browser's own one-tap install dialog.
//   - iPhone/iPad: Safari has no install button a site can trigger, so we
//     show the two steps (Share, then "Add to Home Screen"). This is also
//     what unlocks notifications on iOS (Apple only allows them for Home
//     Screen web apps).
//   - Desktop, or already installed (running standalone), or another
//     browser that can't install: nothing is shown.
//
// "Not now" hides it for good on this device (localStorage), so it doesn't
// nag. Rendered on both dashboards and the Messages inbox.

'use client';

import { useEffect, useState } from 'react';

export const INSTALL_DISMISS_KEY = 'kalm-install-prompt-dismissed';
const DISMISS_KEY = INSTALL_DISMISS_KEY;

export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type Mode = 'hidden' | 'android' | 'ios';

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isPhoneOrTablet(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

export default function InstallAppPrompt() {
  const [mode, setMode] = useState<Mode>('hidden');
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // Storage blocked: still offer it.
    }
    if (dismissed || isStandalone() || !isPhoneOrTablet()) return;

    // iPhone: no event will ever fire, so show the manual steps. Deferred
    // a tick so state isn't set synchronously inside the effect.
    const iosTimer = isIos() ? setTimeout(() => setMode('ios'), 0) : null;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the browser's mini-infobar from showing; we show our own card
      setInstallEvent(e as InstallEvent);
      setMode('android');
    };
    const onInstalled = () => setMode('hidden');
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      if (iosTimer) clearTimeout(iosTimer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (mode === 'hidden') return null;

  function notNow() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setMode('hidden');
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'accepted') setMode('hidden');
  }

  return (
    <div className="mb-6 px-4 py-3.5 rounded-[6px] border border-line bg-paper flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon from /public */}
        <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-[8px] shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Add (kalm) to your home screen</p>
          <p className="text-xs text-stone mt-0.5">
            {mode === 'ios'
              ? 'Tap the Share button, then "Add to Home Screen". Open (kalm) from there to also get notifications.'
              : 'Open (kalm) like an app, one tap from your home screen.'}
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {mode === 'android' && installEvent && (
          <button
            onClick={install}
            className="text-xs font-medium px-4 py-2 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
          >
            Install app
          </button>
        )}
        <button onClick={notNow} className="text-xs text-stone underline underline-offset-2 hover:text-ink px-1">
          Not now
        </button>
      </div>
    </div>
  );
}
