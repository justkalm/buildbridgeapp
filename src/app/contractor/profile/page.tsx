// src/app/contractor/profile/page.tsx
//
// Self-service profile editing. Submitting this form hits
// PATCH /api/contractors/me, which resets verificationStatus to PENDING —
// see that route's file header for why. The warning banner here exists so
// this isn't a surprise mid-edit.

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

type ContractorMe = {
  id: string;
  name: string;
  bio: string | null;
  city: string;
  area: string;
  tradeTypes: string[];
  yearsInBusiness: number | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  gstRegistered: boolean;
  insuranceCoverLakh: number | null;
  phone: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
};

const inputCls =
  'w-full px-3.5 py-2.5 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink';

export default function ContractorProfilePage() {
  const { status: sessionStatus, data: session } = useSession();
  const router = useRouter();
  const [me, setMe] = useState<ContractorMe | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch('/api/contractors/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bio: me.bio ?? '',
        city: me.city,
        area: me.area,
        tradeTypes: me.tradeTypes,
        yearsInBusiness: me.yearsInBusiness,
        teamSizeMin: me.teamSizeMin,
        teamSizeMax: me.teamSizeMax,
        gstRegistered: me.gstRegistered,
        insuranceCoverLakh: me.insuranceCoverLakh,
        phone: me.phone,
      }),
    });

    if (res.ok) {
      const updated = await res.json();
      setMe(updated);
      setSaved(true);
    } else {
      const data = await res.json();
      setError(data.error ?? 'Something went wrong');
    }
    setSaving(false);
  }

  if (sessionStatus !== 'authenticated' || !me) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[720px] mx-auto px-8 py-10 w-full">
        <Link href="/contractor/dashboard" className="text-sm text-stone hover:text-ink mb-6 inline-block">
          ← Back to dashboard
        </Link>
        <h1 className="font-display font-light text-[28px] mb-2">Edit your profile</h1>

        {me.verificationStatus === 'VERIFIED' && (
          <div className="mb-6 px-4 py-3 rounded-[6px] bg-paper-dim text-stone text-sm">
            You&apos;re currently verified. Saving changes here will move your listing back to
            pending review until admin re-checks it.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Bio</label>
            <textarea
              rows={3}
              value={me.bio ?? ''}
              onChange={(e) => setMe({ ...me, bio: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">City</label>
              <input
                required
                value={me.city}
                onChange={(e) => setMe({ ...me, city: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Area</label>
              <input
                required
                value={me.area}
                onChange={(e) => setMe({ ...me, area: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Trade types (comma-separated)</label>
            <input
              value={me.tradeTypes.join(', ')}
              onChange={(e) =>
                setMe({
                  ...me,
                  tradeTypes: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Years in business</label>
              <input
                type="number"
                min={0}
                value={me.yearsInBusiness ?? ''}
                onChange={(e) =>
                  setMe({ ...me, yearsInBusiness: e.target.value ? Number(e.target.value) : null })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Team size (min)</label>
              <input
                type="number"
                min={0}
                value={me.teamSizeMin ?? ''}
                onChange={(e) =>
                  setMe({ ...me, teamSizeMin: e.target.value ? Number(e.target.value) : null })
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Team size (max)</label>
              <input
                type="number"
                min={0}
                value={me.teamSizeMax ?? ''}
                onChange={(e) =>
                  setMe({ ...me, teamSizeMax: e.target.value ? Number(e.target.value) : null })
                }
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1.5">Insurance cover (₹ lakh)</label>
              <input
                type="number"
                min={0}
                value={me.insuranceCoverLakh ?? ''}
                onChange={(e) =>
                  setMe({ ...me, insuranceCoverLakh: e.target.value ? Number(e.target.value) : null })
                }
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 text-sm pb-2.5">
              <input
                type="checkbox"
                checked={me.gstRegistered}
                onChange={(e) => setMe({ ...me, gstRegistered: e.target.checked })}
              />
              GST registered
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone (used for quote notifications)</label>
            <input
              required
              type="tel"
              value={me.phone}
              onChange={(e) => setMe({ ...me, phone: e.target.value })}
              className={inputCls}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-sage">Saved.</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60 self-start px-8"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </main>
      <Footer />
    </>
  );
}
