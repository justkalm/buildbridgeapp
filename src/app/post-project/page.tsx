// src/app/post-project/page.tsx
//
// The general "tell us about your project" form — separate from the
// per-contractor "Request a Quote" flow on a contractor's profile page.
// No contractor is picked here; this goes to admin only (see ProjectPost
// schema comment). Same visual language as the quote-request form on the
// contractor profile page, since it's the same kind of form for the
// developer filling it out, just without a contractor already chosen.
//
// Errors: the API's own `error` message is shown verbatim for every
// failure status (400 validation, 403 unverified email, 429 rate limit),
// since each is already written for a human. For 403 with
// code 'EMAIL_NOT_VERIFIED' we also show a link to the dashboard, which
// is where the "resend verification email" button lives.
//
// Location stays one free-text "Area, City" field (developers are never
// asked for their own location anywhere else, including signup). It's
// tidied with normalizeLocation (src/lib/location.ts) on blur so posts read
// consistently for admin ("andheri west, mumbai" becomes "Andheri West,
// Mumbai"); the API applies the same rule, so this is just so the
// developer sees the saved spelling.

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { normalizeLocation } from '@/lib/location';
import { VERIFICATION_EMAIL } from '@/lib/site';
import { TRADES } from '@/lib/trade-types';
import { digitsOnly } from '@/lib/budget';
import { MAX_BUILT_UP_AREA_SQFT, NEEDED_BY_OPTIONS } from '@/lib/project-fields';

const inputCls = 'w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

export default function PostProjectPage() {
  const { status: sessionStatus, data: session } = useSession();
  const router = useRouter();

  const [projectType, setProjectType] = useState('');
  const [location, setLocation] = useState('');
  const [trades, setTrades] = useState<string[]>([]);
  const [areaDigits, setAreaDigits] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [budgetRangeLabel, setBudgetRangeLabel] = useState('Not sure yet');
  const [details, setDetails] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
    // The nav link to this page is already hidden from contractors (see
    // Nav.tsx), but that alone doesn't stop a contractor who bookmarks the
    // URL or types it directly from landing here and being confused into
    // thinking this is where THEY post a project — this form is
    // developer-only. Redirect to their own dashboard instead of just
    // showing a "not allowed" wall, since that's the page they actually
    // meant to reach.
    if (
      sessionStatus === 'authenticated' &&
      (session?.user as { role?: string })?.role !== 'developer'
    ) {
      router.push('/contractor/dashboard');
    }
  }, [sessionStatus, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    if (trades.length === 0) {
      setError('Pick at least one trade you need.');
      return;
    }
    setSubmitting(true);

    try {
      const res = await fetch('/api/project-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectType,
          location,
          budgetRangeLabel,
          details,
          contactPhone,
          trades,
          neededBy,
          builtUpAreaSqft: areaDigits ? Number(areaDigits) : null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Something went wrong. Please try again.');
        setNeedsVerification(data.code === 'EMAIL_NOT_VERIFIED');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  }

  if (
    sessionStatus !== 'authenticated' ||
    (session?.user as { role?: string })?.role !== 'developer'
  ) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[560px] mx-auto px-5 sm:px-8 py-12 w-full">
        <h1 className="font-display font-light text-[28px] mb-2">Post a project</h1>
        <p className="text-stone text-sm mb-8">
          Tell us what you need. We&apos;ll review it and connect you with the right contractor
          directly, rather than you having to browse and pick one yourself.
        </p>

        {submitted ? (
          <div className="border border-line rounded-[6px] p-6">
            <p className="text-sage font-medium mb-1">Project submitted.</p>
            <p className="text-stone text-sm">
              We&apos;ll review the details and reach out once we&apos;ve matched you with a
              contractor.
            </p>
            <p className="text-stone text-sm mt-2">
              Have a BOQ or drawings? Email them to {VERIFICATION_EMAIL} with your project type and
              location. We share them only with the contractors we match you with.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4">
              <Link href="/dashboard#projects" className="text-ink font-medium text-sm">
                Follow its progress →
              </Link>
              <Link href="/browse" className="text-stone text-sm hover:text-ink">
                Browse contractors in the meantime
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Project type</label>
              <input
                required
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                placeholder="e.g. Residential renovation, 12-floor tower"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={(e) => setLocation(normalizeLocation(e.target.value))}
                placeholder="Area, City"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Which trades do you need?</label>
              <p className="text-xs text-stone mb-2">Pick every trade you are hiring for on this project.</p>
              <div className="flex flex-wrap gap-2">
                {TRADES.map((t) => {
                  const on = trades.includes(t.trade);
                  return (
                    <button
                      key={t.trade}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTrades((cur) => (on ? cur.filter((x) => x !== t.trade) : [...cur, t.trade]))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        on ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink border-line hover:border-ink'
                      }`}
                    >
                      {t.trade}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label htmlFor="post-area" className="block text-sm font-medium mb-1.5">
                Built-up area in sq ft <span className="font-normal text-stone">(optional)</span>
              </label>
              <input
                id="post-area"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={areaDigits ? Number(areaDigits).toLocaleString('en-IN') : ''}
                onChange={(e) => {
                  const next = digitsOnly(e.target.value);
                  if (!next || Number(next) <= MAX_BUILT_UP_AREA_SQFT) setAreaDigits(next);
                }}
                placeholder="e.g. 30,000"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="post-needed-by" className="block text-sm font-medium mb-1.5">When do you need the contractor?</label>
              <select
                id="post-needed-by"
                required
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>Choose one</option>
                {NEEDED_BY_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Estimated budget for this work</label>
              <p className="text-xs text-stone mb-2">For the trades you picked above, not the whole building.</p>
              <select
                value={budgetRangeLabel}
                onChange={(e) => setBudgetRangeLabel(e.target.value)}
                className={inputCls}
              >
                <option>Not sure yet</option>
                <option>Under ₹50 L</option>
                <option>₹50 L – ₹1 Cr</option>
                <option>₹1 Cr – ₹3 Cr</option>
                <option>₹3 Cr – ₹10 Cr</option>
                <option>₹10 Cr – ₹25 Cr</option>
                <option>₹25 Cr+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Project details</label>
              <textarea
                required
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Scope of work, anything a contractor would need to know"
                className={inputCls}
              />
              <p className="text-xs text-stone mt-1.5">
                Have a BOQ or drawings? Email them to {VERIFICATION_EMAIL} after you submit, with your project
                type and location. We share them only with the contractors we match you with.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Phone</label>
              <input
                required
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91XXXXXXXXXX"
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-sm text-danger">
                {error}
                {needsVerification && (
                  <>
                    {' '}
                    <Link href="/dashboard" className="underline underline-offset-2">
                      Go to your dashboard
                    </Link>
                  </>
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit project'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </>
  );
}
