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

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

type ContractorMe = {
  dataSharingConsent: boolean;
  dataSharingConsentAt: string | null;
};

export default function ContractorConsentPage() {
  const { status: sessionStatus, data: session } = useSession();
  const router = useRouter();
  const [me, setMe] = useState<ContractorMe | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/login');
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

  async function toggle(consent: boolean) {
    setSaving(true);
    const res = await fetch('/api/contractors/me/consent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMe(updated);
    }
    setSaving(false);
  }

  if (sessionStatus !== 'authenticated' || !me) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[600px] mx-auto px-8 py-10 w-full">
        <Link href="/contractor/dashboard" className="text-sm text-stone hover:text-ink mb-6 inline-block">
          ← Back to dashboard
        </Link>
        <h1 className="font-display font-light text-[28px] mb-4">Data sharing</h1>
        <p className="text-stone text-sm mb-6">
          (kalm) partners with material suppliers who may want to reach contractors on the
          platform. If you opt in, your business details — company name, trade types, and
          contact information — may be shared with these supplier partners. Your project history
          and developer contacts are never shared. You can change this at any time.
        </p>

        <div className="border border-line rounded-[6px] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">Share my data with material suppliers</p>
            {me.dataSharingConsent && me.dataSharingConsentAt && (
              <p className="text-xs text-stone mt-1">
                Consented on {new Date(me.dataSharingConsentAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={() => toggle(!me.dataSharingConsent)}
            disabled={saving}
            className={`shrink-0 w-12 h-7 rounded-full transition-colors relative disabled:opacity-60 ${
              me.dataSharingConsent ? 'bg-sage' : 'bg-paper-dim'
            }`}
            aria-pressed={me.dataSharingConsent}
            aria-label="Toggle data sharing consent"
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-paper transition-transform ${
                me.dataSharingConsent ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
