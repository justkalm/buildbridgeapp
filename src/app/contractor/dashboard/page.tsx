// src/app/contractor/dashboard/page.tsx
//
// Contractor's home base. Mirrors the client-side auth-guard pattern used
// by src/app/dashboard/page.tsx (developer dashboard): redirect on
// unauthenticated, render nothing until session is confirmed. The actual
// data fetch (GET /api/contractors/me) also checks the session server-side
// — this page-level guard is about UX (don't flash the page before
// redirecting), not the real security boundary.

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

type QuoteRequestRow = {
  id: string;
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  details: string;
  status: 'PENDING' | 'CONTACTED' | 'DECLINED';
  createdAt: string;
  developer: { name: string; email: string; phone: string };
};

type ProjectAlertRow = {
  id: string;
  alertedAt: string;
  projectPost: {
    projectType: string;
    location: string;
    budgetRangeLabel: string;
    details: string;
    contactPhone: string;
    developer: { name: string; email: string };
  };
};

type ContractorMe = {
  id: string;
  name: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  tier: 'LISTED' | 'PLUS' | 'PRO';
  emailVerified: boolean;
  quoteRequests: QuoteRequestRow[];
  projectAlerts: ProjectAlertRow[];
};

const verificationCopy: Record<ContractorMe['verificationStatus'], { label: string; style: string }> = {
  PENDING: { label: 'Verification pending', style: 'bg-paper-dim text-stone' },
  VERIFIED: { label: 'Verified', style: 'bg-sage-soft text-sage' },
  REJECTED: { label: 'Verification rejected', style: 'bg-red-50 text-red-700' },
};

const tierLabel: Record<ContractorMe['tier'], string> = {
  LISTED: 'Listed (free)',
  PLUS: 'Plus',
  PRO: 'Pro',
};

export default function ContractorDashboardPage() {
  const { status: sessionStatus, data: session } = useSession();
  const router = useRouter();
  const [me, setMe] = useState<ContractorMe | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
    // A developer who somehow lands here shouldn't see contractor data.
    if (
      sessionStatus === 'authenticated' &&
      (session?.user as { role?: string })?.role !== 'contractor'
    ) {
      router.push('/browse');
    }
  }, [sessionStatus, session, router]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    fetch('/api/contractors/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe);
  }, [sessionStatus]);

  if (sessionStatus !== 'authenticated' || !me) {
    // Previously returned null here — a fully blank white page (no Nav,
    // no Footer) during the session check and the me-fetch, unlike every
    // other dashboard/account page in the app which keeps the layout
    // mounted and shows a "Loading…" message in the content area instead.
    // Keeping Nav/Footer up avoids the blank-flash and matches the
    // developer dashboard's loading treatment.
    return (
      <>
        <Nav />
        <main className="flex-1 max-w-[1440px] mx-auto px-8 py-10 w-full">
          <p className="text-sm text-stone">Loading…</p>
        </main>
        <Footer />
      </>
    );
  }

  const verification = verificationCopy[me.verificationStatus];

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[1440px] mx-auto px-8 py-10 w-full">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-9">
          <div>
            <h1 className="font-display font-light text-[28px] mb-1">Welcome back, {me.name}</h1>
            <p className="text-stone text-[14.5px]">Your (kalm) contractor dashboard.</p>
          </div>
          <nav className="flex gap-2 flex-wrap">
            <Link
              href="/contractor/profile"
              className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full border border-line hover:bg-paper-dim transition-colors"
            >
              Edit profile
            </Link>
            <Link
              href="/contractor/projects"
              className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full border border-line hover:bg-paper-dim transition-colors"
            >
              Manage projects
            </Link>
            <Link
              href="/contractor/consent"
              className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full border border-line hover:bg-paper-dim transition-colors"
            >
              Data sharing
            </Link>
          </nav>
        </div>

        {!me.emailVerified && (
          <div className="mb-6 px-4 py-3 rounded-[6px] bg-paper-dim text-stone text-sm">
            Your email isn&apos;t verified yet — check your inbox for a verification link.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-9">
          <div className="border border-line rounded-[6px] p-5">
            <p className="text-xs text-stone mb-2">Listing status</p>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${verification.style}`}>
              {verification.label}
            </span>
            {me.verificationStatus !== 'PENDING' && (
              <p className="text-xs text-stone mt-2">
                Editing your profile or projects will reset this to pending review.
              </p>
            )}
          </div>
          <div className="border border-line rounded-[6px] p-5">
            <p className="text-xs text-stone mb-2">Current tier</p>
            <p className="text-lg font-medium">{tierLabel[me.tier]}</p>
            <p className="text-xs text-stone mt-2">
              Free during the current trial period. Paid tiers coming later.
            </p>
          </div>
        </div>

        {me.projectAlerts.length > 0 && (
          <>
            <h2 className="font-display font-light text-xl mb-1">Project alerts</h2>
            <p className="text-stone text-xs mb-4">
              Projects our team has personally matched to your profile.
            </p>
            <div className="flex flex-col gap-3 mb-10">
              {me.projectAlerts.map((a) => (
                <div key={a.id} className="border border-ink rounded-[6px] p-4">
                  <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                    <div>
                      <p className="font-medium text-sm">{a.projectPost.developer.name}</p>
                      <p className="text-stone text-xs mt-0.5">
                        {a.projectPost.projectType} · {a.projectPost.location} · {a.projectPost.budgetRangeLabel}
                      </p>
                    </div>
                    <span className="text-xs text-stone">
                      {new Date(a.alertedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm mb-3">{a.projectPost.details}</p>
                  <div className="flex gap-4 text-xs text-stone border-t border-line pt-2.5">
                    <a href={`mailto:${a.projectPost.developer.email}`} className="hover:text-ink underline underline-offset-2">
                      {a.projectPost.developer.email}
                    </a>
                    <a href={`tel:${a.projectPost.contactPhone}`} className="hover:text-ink underline underline-offset-2">
                      {a.projectPost.contactPhone}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="font-display font-light text-xl mb-4">Quote requests received</h2>
        {me.quoteRequests.length === 0 ? (
          <p className="text-stone text-sm">No quote requests yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {me.quoteRequests.map((r) => (
              <div key={r.id} className="border border-line rounded-[6px] p-4">
                <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                  <div>
                    <p className="font-medium text-sm">{r.developer.name}</p>
                    <p className="text-stone text-xs mt-0.5">
                      {r.projectType} · {r.location} · {r.budgetRangeLabel}
                    </p>
                  </div>
                  <span className="text-xs text-stone">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm mb-3">{r.details}</p>
                <div className="flex gap-4 text-xs text-stone border-t border-line pt-2.5">
                  <a href={`mailto:${r.developer.email}`} className="hover:text-ink underline underline-offset-2">
                    {r.developer.email}
                  </a>
                  <a href={`tel:${r.developer.phone}`} className="hover:text-ink underline underline-offset-2">
                    {r.developer.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
