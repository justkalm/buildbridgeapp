'use client';

// Sign out of admin on this device, or on every device at once (for a lost
// laptop or a shared computer). Both end the session on the server, not
// just in this browser; see src/lib/admin-auth.ts. "All devices" asks for
// a second click on the page itself rather than a browser confirm()
// pop-up, which some browsers (and in-app browsers) silently block.

import { useState } from 'react';

export default function AdminSignOutButtons() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingAll, setConfirmingAll] = useState(false);

  async function signOut(everywhere: boolean) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ everywhere }),
      });
      if (!res.ok) throw new Error();
      window.location.href = '/admin';
    } catch {
      setError('Could not sign out. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 pt-6 border-t border-line">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => signOut(false)}
          disabled={busy}
          className="text-sm border border-line rounded-md px-4 py-2 hover:border-ink disabled:opacity-50"
        >
          Sign out
        </button>
        {confirmingAll ? (
          <>
            <button
              type="button"
              onClick={() => signOut(true)}
              disabled={busy}
              className="text-sm rounded-md px-4 py-2 bg-danger text-white disabled:opacity-50"
            >
              Yes, sign out everywhere
            </button>
            <button
              type="button"
              onClick={() => setConfirmingAll(false)}
              disabled={busy}
              className="text-sm border border-line rounded-md px-4 py-2 hover:border-ink disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingAll(true)}
            disabled={busy}
            className="text-sm border border-line rounded-md px-4 py-2 text-danger hover:border-danger disabled:opacity-50"
          >
            Sign out on all devices
          </button>
        )}
      </div>
      {confirmingAll && (
        <p className="text-sm text-ink mt-3">
          This signs admin out on every device, including this one. You&apos;ll need your password and 2FA code
          to get back in.
        </p>
      )}
      <p className="text-xs text-stone mt-2">
        Use &quot;all devices&quot; if you signed in to admin on a computer you no longer have.
      </p>
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  );
}
