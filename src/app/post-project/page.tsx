// src/app/post-project/page.tsx
//
// The general "tell us about your project" form — separate from the
// per-contractor "Request a Quote" flow on a contractor's profile page.
// No contractor is picked here; this goes to admin only (see ProjectPost
// schema comment). Same visual language as the quote-request form on the
// contractor profile page, since it's the same kind of form for the
// developer filling it out, just without a contractor already chosen.

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const inputCls = 'w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

export default function PostProjectPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();

  const [projectType, setProjectType] = useState('');
  const [location, setLocation] = useState('');
  const [budgetRangeLabel, setBudgetRangeLabel] = useState('Under ₹50 L');
  const [details, setDetails] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [sessionStatus, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/project-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectType, location, budgetRangeLabel, details, contactPhone }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  }

  if (sessionStatus !== 'authenticated') {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[560px] mx-auto px-8 py-12 w-full">
        <h1 className="font-display font-light text-[28px] mb-2">Post a project</h1>
        <p className="text-stone text-sm mb-8">
          Tell us what you need — we&apos;ll review it and connect you with the right contractor
          directly, rather than you having to browse and pick one yourself.
        </p>

        {submitted ? (
          <div className="border border-line rounded-[6px] p-6">
            <p className="text-sage font-medium mb-1">Project submitted.</p>
            <p className="text-stone text-sm">
              We&apos;ll review the details and reach out once we&apos;ve matched you with a
              contractor.
            </p>
            <Link href="/browse" className="text-ink font-medium text-sm mt-4 inline-block">
              Browse contractors in the meantime →
            </Link>
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
                placeholder="Area, City"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Estimated budget</label>
              <select
                value={budgetRangeLabel}
                onChange={(e) => setBudgetRangeLabel(e.target.value)}
                className={inputCls}
              >
                <option>Under ₹50 L</option>
                <option>₹50 L – ₹1 Cr</option>
                <option>₹1 Cr – ₹3 Cr</option>
                <option>₹3 Cr+</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Project details</label>
              <textarea
                required
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Scope of work, timeline, anything a contractor would need to know"
                className={inputCls}
              />
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

            {error && <p className="text-sm text-red-600">{error}</p>}

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
