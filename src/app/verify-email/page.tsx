// src/app/verify-email/page.tsx
//
// Landing page for the link sent by sendVerificationEmail. Reads ?token=
// from the URL, calls the verify API automatically on load, and shows the
// result — no form, no button to click, since the token in the URL is
// already the whole action.

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  // Defaults to 'developer' so links already sent before this change (with
  // no ?role= param) keep working exactly as before.
  const role = searchParams.get('role') === 'contractor' ? 'contractor' : 'developer';
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('No verification token was provided.');
      return;
    }

    fetch(`/api/${role}s/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
        } else {
          setStatus('error');
          setError(data.error ?? 'Something went wrong.');
        }
      })
      .catch(() => {
        setStatus('error');
        setError('Something went wrong. Please try again.');
      });
  }, [token, role]);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-[420px] text-center">
        {status === 'checking' && <p className="text-stone text-sm">Verifying your email…</p>}

        {status === 'success' && (
          <>
            <h1 className="font-display font-light text-2xl mb-3">Email verified</h1>
            <p className="text-stone text-sm mb-8">Your email is confirmed. You&apos;re all set.</p>
            <Link
              href={role === 'contractor' ? '/contractor/dashboard' : '/browse'}
              className="inline-flex items-center justify-center text-sm px-6 py-3 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
            >
              {role === 'contractor' ? 'Go to dashboard' : 'Browse Contractors'}
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="font-display font-light text-2xl mb-3">Couldn&apos;t verify email</h1>
            <p className="text-stone text-sm mb-8">{error}</p>
            <Link href="/login" className="text-sm text-ink underline underline-offset-2">
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={null}>
        <VerifyEmailInner />
      </Suspense>
      <Footer />
    </>
  );
}
