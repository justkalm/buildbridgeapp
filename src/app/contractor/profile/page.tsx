// src/app/contractor/profile/page.tsx
//
// Self-service profile editing. Submitting this form hits
// PATCH /api/contractors/me, which now only resets verificationStatus to
// PENDING when a CREDENTIAL field actually changes (city, area, phone,
// GST registration, trade types) — see that route's file header for the
// full reasoning and CREDENTIAL_FIELDS list. Cosmetic fields (bio, team
// size, years in business, insurance cover) no longer touch verification.
//
// The form below is grouped into two visual sections — "Profile details"
// (cosmetic, safe to edit any time) and "Verified credentials" (resets
// verification if changed) — so a contractor can see at a glance which
// edits are consequence-free. If any credential field is actually being
// changed on a currently-Verified profile, submitting shows a confirm
// step instead of saving immediately, since that save has a real,
// possibly-unwanted side effect (dropping out of Verified + browse until
// admin re-checks).

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import TradeTypePicker from '@/components/TradeTypePicker';
import { normalizeLocation } from '@/lib/location';

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
  // Snapshot of the credential fields as loaded from the server, used only
  // to detect whether the contractor has actually changed one of them —
  // must mirror the server's CREDENTIAL_FIELDS list in
  // src/app/api/contractors/me/route.ts (city, area, phone, gstRegistered,
  // tradeTypes) so the confirm step fires in exactly the same cases the
  // API will reset verification for.
  const [original, setOriginal] = useState<ContractorMe | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

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
      .then((data) => {
        setMe(data);
        setOriginal(data);
      });
  }, [sessionStatus]);

  // Same field set as CREDENTIAL_FIELDS server-side — see the state
  // comment above on why this has to stay in sync with the API.
  function credentialFieldsChanged(a: ContractorMe, b: ContractorMe): boolean {
    const tradeTypesChanged =
      a.tradeTypes.length !== b.tradeTypes.length ||
      [...a.tradeTypes].sort().some((t, i) => t !== [...b.tradeTypes].sort()[i]);
    return (
      a.city !== b.city ||
      a.area !== b.area ||
      a.phone !== b.phone ||
      a.gstRegistered !== b.gstRegistered ||
      tradeTypesChanged
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !original) return;

    // A currently-Verified contractor changing a credential field is
    // about to lose that status and drop out of browse until admin
    // re-checks — confirm before submitting rather than surfacing that as
    // a surprise after the fact via the "Saved." message.
    if (
      !confirmingReset &&
      me.verificationStatus === 'VERIFIED' &&
      credentialFieldsChanged(me, original)
    ) {
      setConfirmingReset(true);
      return;
    }
    setConfirmingReset(false);

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
      setOriginal(updated);
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

  // Every onChange below routes through this instead of calling setMe
  // directly, so that editing a field after a confirm prompt was shown
  // re-evaluates on the next submit rather than reusing a stale decision.
  function update(patch: Partial<ContractorMe>) {
    setConfirmingReset(false);
    setMe((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  const pendingCredentialReset =
    me.verificationStatus === 'VERIFIED' && original ? credentialFieldsChanged(me, original) : false;

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
            You&apos;re currently verified. Changing anything in &quot;Verified credentials&quot;
            below will move your listing back to pending review until admin re-checks it. The
            rest of your profile is safe to edit any time.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <fieldset className="flex flex-col gap-4">
            <legend className="font-display text-base mb-1">Profile details</legend>
            <p className="text-xs text-stone -mt-2 mb-1">
              Cosmetic details: editing these never affects your verification status.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5">Bio</label>
              <textarea
                rows={3}
                value={me.bio ?? ''}
                onChange={(e) => update({ bio: e.target.value })}
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
                    update({ yearsInBusiness: e.target.value ? Number(e.target.value) : null })
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
                    update({ teamSizeMin: e.target.value ? Number(e.target.value) : null })
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
                    update({ teamSizeMax: e.target.value ? Number(e.target.value) : null })
                  }
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Insurance cover (₹ lakh)</label>
              <input
                type="number"
                min={0}
                value={me.insuranceCoverLakh ?? ''}
                onChange={(e) =>
                  update({ insuranceCoverLakh: e.target.value ? Number(e.target.value) : null })
                }
                className={inputCls}
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4 pt-6 border-t border-line">
            <legend className="font-display text-base mb-1">Verified credentials</legend>
            <p className="text-xs text-stone -mt-2 mb-1">
              These are what admin actually checks before marking you Verified (location, trade
              license, GST, and a direct conversation): changing one sends you back to Pending
              review if you&apos;re currently Verified.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">City</label>
                <input
                  required
                  value={me.city}
                  onChange={(e) => update({ city: e.target.value })}
                  onBlur={(e) => update({ city: normalizeLocation(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Area</label>
                <input
                  required
                  value={me.area}
                  onChange={(e) => update({ area: e.target.value })}
                  onBlur={(e) => update({ area: normalizeLocation(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Trade types</label>
              <TradeTypePicker
                selected={me.tradeTypes}
                onChange={(next) => update({ tradeTypes: next })}
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm pb-2.5">
                <input
                  type="checkbox"
                  checked={me.gstRegistered}
                  onChange={(e) => update({ gstRegistered: e.target.checked })}
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
                onChange={(e) => update({ phone: e.target.value })}
                className={inputCls}
              />
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-sage">Saved.</p>}

          {confirmingReset && pendingCredentialReset && (
            <div className="px-4 py-3.5 rounded-[6px] bg-red-50 border border-red-200 text-sm text-red-700 flex flex-col gap-3">
              <p>
                Changing your verified credentials will send your profile back for
                re-verification and hide it from browse until admin reviews it. Continue?
              </p>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="text-xs font-medium px-4 py-2 rounded-full bg-red-600 text-white"
                >
                  Yes, save and go back to Pending
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="text-xs font-medium px-4 py-2 rounded-full border border-line text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!confirmingReset && (
            <button
              type="submit"
              disabled={saving}
              className="mt-2 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60 self-start px-8"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </form>
      </main>
      <Footer />
    </>
  );
}
