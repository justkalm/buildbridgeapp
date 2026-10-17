// src/app/reset-password/page.tsx

'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { PASSWORD_MIN_LENGTH, PASSWORD_HINT } from '@/lib/password-rules';
import PasswordInput from '@/components/PasswordInput';

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const role = searchParams.get('role') === 'contractor' ? 'contractor' : 'developer';
  // Set by the "your listing is ready" email (src/lib/contractor-invite.ts):
  // a first password, not a reset, so the words say so. Wording only.
  const welcome = searchParams.get('welcome') === '1';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/${role}s/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        // A run-out welcome link: say what the email promised.
        if (welcome && res.status === 400 && /invalid or has expired/.test(data.error ?? '')) {
          setError('This link has run out. Reply to the (kalm) email and we will send you a new one.');
          setSubmitting(false);
          return;
        }
        setError(data.error ?? 'Something went wrong');
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[420px] text-center">
          <h1 className="font-display font-light text-2xl mb-3">Invalid link</h1>
          <p className="text-stone text-sm mb-8">This password reset link is missing a token.</p>
          <Link href="/forgot-password" className="text-sm text-ink underline underline-offset-2">
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px]">
        {success ? (
          <>
            <h1 className="font-display font-light text-2xl mb-3">{welcome ? 'Password set' : 'Password updated'}</h1>
            <p className="text-stone text-sm">Redirecting you to sign in…</p>
          </>
        ) : (
          <>
            <h1 className="font-display font-light text-3xl mb-2">
              {welcome ? 'Set your password' : 'Set a new password'}
            </h1>
            <p className="text-stone text-sm mb-8">
              {welcome
                ? 'Choose a password for your (kalm) dashboard. You will sign in with your email and this password.'
                : 'Choose a new password for your account.'}
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{welcome ? 'Password' : 'New password'}</label>
                <PasswordInput
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                />
                <p className="text-xs text-stone mt-1">{PASSWORD_HINT}</p>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
              >
                {submitting ? 'Saving…' : welcome ? 'Set password' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={null}>
        <ResetPasswordInner />
      </Suspense>
      <Footer />
    </>
  );
}
