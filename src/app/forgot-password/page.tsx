// src/app/forgot-password/page.tsx
//
// One "forgot password" form for developers AND contractors, matching the
// single login form (src/lib/auth.ts tries developer, then contractor).
// The login page's "Forgot password?" link carries no role, and this page
// used to default to developer, so a contractor entering their email got
// "a link has been sent" while nothing was ever sent: the developer route
// found no developer with that address. Now, unless a link explicitly
// says ?role=contractor or ?role=developer, the request goes to BOTH
// routes; each one only emails if it owns that address, and both give the
// same generic answer, so this still doesn't reveal which emails have
// accounts or what kind.

'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

function ForgotPasswordInner() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  const roles =
    roleParam === 'contractor' ? ['contractor'] : roleParam === 'developer' ? ['developer'] : ['developer', 'contractor'];
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await Promise.allSettled(
        roles.map((role) =>
          fetch(`/api/${role}s/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
        )
      );
    } finally {
      setSubmitted(true);
      setSubmitting(false);
    }
  }

  return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[420px]">
          {submitted ? (
            <>
              <h1 className="font-display font-light text-3xl mb-2">Check your email</h1>
              <p className="text-stone text-sm">
                If an account exists for {email}, we&apos;ve sent a link to reset your password.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display font-light text-3xl mb-2">Reset your password</h1>
              <p className="text-stone text-sm mb-8">
                Enter your email and we&apos;ll send you a link to reset it.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
          <p className="text-sm text-stone mt-6">
            <Link href="/login" className="text-ink underline underline-offset-2">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={null}>
        <ForgotPasswordInner />
      </Suspense>
      <Footer />
    </>
  );
}
