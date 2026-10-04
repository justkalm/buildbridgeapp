// src/app/contractor/consent/page.tsx
//
// Explicit, standalone opt-in for sharing this contractor's business data
// with material suppliers. Deliberately its own page (not a checkbox
// buried in the profile form) and calls the dedicated
// PATCH /api/contractors/me/consent endpoint, which does NOT reset
// verification status — see that route's comment.
//
// The specific language here matters: this is a business decision, not
// legal copy. Before this goes live with a real contractor base, have
// whoever's handling legal (Hassan, per the project notes) review the
// actual consent wording — this is a functional placeholder, not
// contract-ready text.

'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export default function ContractorConsentPage() {
  const { status: sessionStatus, data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/login');
    if (
      sessionStatus === 'authenticated' &&
      (session?.user as { role?: string })?.role !== 'contractor'
    ) {
      router.push('/browse');
    }
  }, [sessionStatus, session, router]);

  if (sessionStatus !== 'authenticated') {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[600px] mx-auto px-5 sm:px-8 py-10 w-full">
        <Link href="/contractor/dashboard" className="text-sm text-stone hover:text-ink mb-6 inline-block">
          ← Back to dashboard
        </Link>
        <h1 className="font-display font-light text-[28px] mb-4">Data sharing</h1>
        {/* Supplier-sharing toggle hidden (owner, 4 Oct 2026) until a supplier
            side exists. The /api/contractors/me/consent route and the
            dataSharingConsent columns are untouched, so it can come back by
            restoring the toggle block from git history. */}
        <p className="text-stone text-sm">
          (kalm) does not share your business details with anyone. If we ever offer to
          connect you with material suppliers, we will ask for your permission here first.
          Your project history and developer contacts are never shared.
        </p>
      </main>
      <Footer />
    </>
  );
}
