// src/app/contractor/signup/page.tsx
//
// Mirrors src/app/signup/page.tsx exactly (same visual pattern, same form
// shape), pointed at /api/contractors/signup instead of
// /api/developers/signup. Also covers the CLAIM case — if this email
// matches a contractor admin already entered, the API does NOT set a
// password or sign anyone in; it emails a claim link to the address on
// file and returns `claimRequested`, and this page shows a "check your
// email" screen instead of redirecting (see the API route header for the
// account-takeover reasoning). Password min length / hint text come from
// src/lib/password-rules.ts, shared with the server-side policy.
//
// City and area are required here so a new listing has a real location
// from day one (developers filter /browse by it, and admin won't verify a
// contractor without one). Both are tidied with normalizeLocation on blur
// so the person sees the saved spelling before submitting; the API applies
// the same rule regardless. The fields are always shown, because the form
// can't tell a fresh signup from a claim before submitting. On a claim the
// API ignores them and keeps the location admin already entered (see the
// route's header comment), which is why the hint under the fields says so.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { PASSWORD_MIN_LENGTH, PASSWORD_HINT } from '@/lib/password-rules';
import { normalizeLocation } from '@/lib/location';
import PasswordInput from '@/components/PasswordInput';

export default function ContractorSignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [claimRequested, setClaimRequested] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/contractors/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          // Normalized here too in case submit happens without a blur
          // (e.g. pressing Enter in the field); the API does it again.
          city: normalizeLocation(city),
          area: normalizeLocation(area),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        setSubmitting(false);
        return;
      }

      if (data.claimRequested) {
        // This email matches an existing listing — no account was created
        // or signed into here. A claim link was emailed instead; the
        // password only gets set once that link is clicked, which proves
        // the signer-upper actually controls that inbox.
        setClaimRequested(true);
        setSubmitting(false);
        return;
      }

      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      // `ok` alone isn't enough in NextAuth v5 beta — a failed credentials
      // sign-in still resolves ok:true with `error` set (see login page).
      if (signInResult?.ok && !signInResult.error) {
        router.push('/contractor/dashboard');
      } else {
        router.push('/login');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (claimRequested) {
    return (
      <>
        <Nav />
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-[420px] text-center">
            <h1 className="font-display font-light text-2xl mb-3">Check your email</h1>
            <p className="text-stone text-sm">
              This email is already listed on (kalm). If you own it, we&apos;ve sent a link to set
              up your dashboard password.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[420px]">
          <h1 className="font-display font-light text-3xl mb-2">List your business</h1>
          <p className="text-stone text-sm mb-8">
            Create your (kalm) contractor account. If you&apos;re already listed, using the
            same email will link this login to your existing profile.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Business name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <p className="text-xs text-stone mt-1">
                Use the same email admin has on file if you&apos;re already listed.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
              />
            </div>
            <fieldset>
              <legend className="block text-sm font-medium mb-1.5">Where you&apos;re based</legend>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="signup-city" className="block text-xs text-stone mb-1">
                    City
                  </label>
                  <input
                    id="signup-city"
                    type="text"
                    required
                    maxLength={100}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onBlur={(e) => setCity(normalizeLocation(e.target.value))}
                    placeholder="e.g. Mumbai"
                    className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
                <div>
                  <label htmlFor="signup-area" className="block text-xs text-stone mb-1">
                    Area
                  </label>
                  <input
                    id="signup-area"
                    type="text"
                    required
                    maxLength={100}
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    onBlur={(e) => setArea(normalizeLocation(e.target.value))}
                    placeholder="e.g. Andheri West"
                    className="w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
              </div>
              <p className="text-xs text-stone mt-1">
                Developers search for contractors by location, and we need it to verify your
                listing. If you&apos;re already listed, we&apos;ll keep the location on your
                existing profile; you can change it from your dashboard later.
              </p>
            </fieldset>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
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

            <p className="text-xs text-stone">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
                Privacy Policy
              </Link>
              .
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-stone mt-6 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-ink font-medium">
              Sign in
            </Link>
          </p>
          <p className="text-sm text-stone mt-2 text-center">
            Looking to hire a contractor?{' '}
            <Link href="/signup" className="text-ink font-medium">
              Sign up as a developer
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
