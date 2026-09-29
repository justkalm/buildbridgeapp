// src/app/login/page.tsx
//
// Error handling notes (NextAuth v5 beta, credentials provider):
//
// - signIn(..., { redirect: false }) resolves with `ok: true` even when the
//   credentials were WRONG — the auth route answers 200 with a JSON body
//   whose `url` carries `?error=CredentialsSignin&code=...`. So success
//   has to be judged on `!result.error`, not `result.ok`. (This page used
//   to check only `ok`, which meant a wrong password could fall through
//   to the "success" branch and bounce the user to /browse signed-out.)
//
// - `result.code` is the only way the server can tell us WHY a sign-in
//   failed. authorize() in src/lib/auth.ts throws a CredentialsSignin
//   subclass with code LOGIN_RATE_LIMITED_CODE when the per-email or
//   per-IP login limit is hit; every other failure (unknown email, wrong
//   password) comes back as the default code and gets the same generic
//   message, so the form never reveals whether an email is registered.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, type SignInResponse } from 'next-auth/react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { LOGIN_RATE_LIMITED_CODE } from '@/lib/auth-codes';
import PasswordInput from '@/components/PasswordInput';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let result: SignInResponse | undefined;
    try {
      result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
      return;
    }

    if (result?.ok && !result.error) {
      // Role isn't known from the signIn result itself — fetch the session
      // to find out whether this was a developer or contractor login, and
      // route to the right home page. A contractor visiting /browse post-
      // login would just see the developer-facing marketplace with no
      // obvious way back to their own dashboard, so this matters.
      const sessionRes = await fetch('/api/auth/session');
      const session = await sessionRes.json();
      const role = session?.user?.role;
      router.push(role === 'contractor' ? '/contractor/dashboard' : '/browse');
    } else if (result?.code === LOGIN_RATE_LIMITED_CODE) {
      setError(
        'Too many sign-in attempts. Please wait 15 minutes and try again, or use “Forgot password?” below to reset it now.'
      );
      setSubmitting(false);
    } else {
      setError('Incorrect email or password');
      setSubmitting(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[420px]">
          <h1 className="font-display font-light text-3xl mb-2">Sign in</h1>
          <p className="text-stone text-sm mb-8">Welcome back.</p>

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
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <PasswordInput
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <Link href="/forgot-password" className="text-xs text-stone hover:text-ink underline underline-offset-2 mt-1.5 inline-block">
                Forgot password?
              </Link>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-stone mt-6 text-center">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-ink font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
