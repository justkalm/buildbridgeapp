// src/app/admin/login-form.tsx
//
// The actual login form, pulled out of page.tsx so page.tsx can be a
// server component that decides login-form vs dashboard based on the
// session cookie. On success this does a full page navigation (not
// router.push) so the server component re-checks the cookie and renders
// the dashboard.
//
// Both password AND the 2FA code are submitted together in one request —
// simpler than a two-step "enter password, then enter code" flow, and
// matches how /api/admin/login expects the request. See that route's
// header comment for why a wrong password vs a wrong code look identical
// in the error message.

'use client';

import { useState } from 'react';

export default function AdminLoginForm() {
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, totpCode }),
    });

    if (res.ok) {
      // Full reload, not client-side nav — page.tsx is a server component
      // that reads the cookie, so it needs a real request to pick up the
      // freshly-set session and render the dashboard instead of the form.
      window.location.href = '/admin';
    } else {
      const data = await res.json();
      setError(data.error ?? 'Incorrect password');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-ink px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-paper rounded-md p-8">
        <h1 className="font-display font-bold text-2xl tracking-tight mb-1">Admin</h1>
        <p className="text-stone text-sm mb-6">Enter the admin password and your 2FA code.</p>

        <input
          type="password"
          required
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink mb-3"
        />

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          maxLength={6}
          placeholder="6-digit code"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
          className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ink mb-3 tracking-[0.3em] text-center font-mono"
        />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-ink text-paper font-semibold text-sm py-3 rounded-[3px] hover:bg-black transition-colors disabled:opacity-60"
        >
          {submitting ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
