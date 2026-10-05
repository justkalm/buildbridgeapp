// src/app/admin/review/page.tsx
//
// The review desk (KALM-253). Three views: Waiting (every project a
// contractor creates or edits sits here, hidden from the public, until it is
// approved or hidden with a reason), Live (so something already public can be
// taken down) and Hidden (so a takedown can be undone). Photos open full size
// in a new tab so they can be properly checked. Each click sends back the
// submittedAt this page was showing, so the server refuses if the contractor
// edited in the meantime. Every action is written to the moderation log.

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import AdminTabs from '@/components/AdminTabs';

type PendingProject = {
  id: string;
  title: string;
  developerName: string | null;
  projectType: string | null;
  squareFeet: number | null;
  elevationFloors: number | null;
  imageUrls: string[];
  moderationNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvalStatus: 'PENDING' | 'APPROVED' | 'HIDDEN';
  contractor: { id: string; name: string; slug: string; verificationStatus: string };
};

type View = 'PENDING' | 'APPROVED' | 'HIDDEN';
const VIEWS: { key: View; label: string; empty: string }[] = [
  { key: 'PENDING', label: 'Waiting', empty: 'Nothing waiting. All caught up.' },
  { key: 'APPROVED', label: 'Live', empty: 'No live projects.' },
  { key: 'HIDDEN', label: 'Hidden', empty: 'Nothing is hidden.' },
];

export default function AdminReviewPage() {
  const [view, setView] = useState<View>('PENDING');
  const [items, setItems] = useState<PendingProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidingId, setHidingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Fetch only: state is set in the callbacks, never synchronously, so this
  // is safe to call from an effect. Clicks that switch or reload the view
  // clear the old list first (see switchView and the 409 branch in act).
  function fetchView(v: View) {
    fetch(`/api/admin/review?status=${v}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setItems)
      .catch(() => {
        setItems([]);
        setError('Failed to load. If your admin session has expired, sign in again.');
      });
  }

  useEffect(() => {
    fetchView(view);
  }, [view]);

  function switchView(v: View) {
    if (v === view) return;
    setItems(null);
    setError(null);
    setView(v);
  }

  async function act(
    p: PendingProject,
    body: { action: 'approve' } | { action: 'hide'; note: string },
  ) {
    const id = p.id;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${id}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, submittedAt: p.submittedAt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = data.error ?? 'Something went wrong';
        // 409: the contractor changed it after this page loaded. Reload so
        // the new version is what gets looked at, then show why.
        if (res.status === 409) {
          setItems(null);
          fetchView(view);
        }
        setError(message);
        return;
      }
      setItems((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
      setHidingId(null);
      setReason('');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <AdminTabs active="review" />
        <h1 className="font-display font-bold text-2xl tracking-tight mb-1">Review</h1>
        <div className="flex gap-2 my-4">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => switchView(v.key)}
              className={`px-3 py-1.5 text-sm rounded-[4px] border ${
                view === v.key ? 'bg-ink text-paper border-ink' : 'border-line text-stone hover:text-ink'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="text-stone text-sm mb-8">
          {items === null
            ? 'Loading...'
            : view === 'PENDING'
              ? `${items.length} project${items.length === 1 ? '' : 's'} waiting. Nothing here is public until you approve it.`
              : `${items.length} project${items.length === 1 ? '' : 's'}.`}
        </p>

        {error && (
          <div className="bg-danger-soft border border-danger/30 text-danger text-sm rounded-md p-4 mb-6">{error}</div>
        )}

        {items && items.length === 0 && (
          <p className="text-sm text-stone border border-line rounded-md p-6">
            {VIEWS.find((v) => v.key === view)?.empty}
          </p>
        )}

        <div className="flex flex-col gap-5">
          {items?.map((p) => (
            <section key={p.id} className="border border-line rounded-md p-5 bg-paper">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h2 className="font-medium">{p.title}</h2>
                <span className="text-xs text-stone">
                  {p.submittedAt ? 'Submitted' : 'Added'}{' '}
                  {new Date(p.submittedAt ?? p.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <p className="text-sm text-stone mb-1">
                {p.contractor.name}
                <span className="text-xs"> ({p.contractor.verificationStatus.toLowerCase()})</span>
              </p>
              <p className="text-xs text-stone mb-3">
                {[
                  p.projectType,
                  p.developerName && `For ${p.developerName}`,
                  p.squareFeet && `${p.squareFeet.toLocaleString('en-IN')} sq ft`,
                  p.elevationFloors && `${p.elevationFloors} floors`,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No details given'}
              </p>

              {p.moderationNote && (
                <p className="text-xs text-danger bg-danger-soft rounded-md p-3 mb-3">
                  {p.approvalStatus === 'HIDDEN'
                    ? `Hidden: ${p.moderationNote}`
                    : `Earlier hidden: ${p.moderationNote}. The contractor has edited and sent it again.`}
                </p>
              )}

              {p.imageUrls.length === 0 ? (
                <p className="text-xs text-stone mb-3">No photos.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-4">
                  {p.imageUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" title="Open full size">
                      <Image
                        src={url}
                        alt={`Photo for ${p.title}`}
                        width={160}
                        height={160}
                        className="w-40 h-40 rounded-md object-cover border border-line"
                      />
                    </a>
                  ))}
                </div>
              )}

              {hidingId === p.id ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-stone" htmlFor={`reason-${p.id}`}>
                    Reason (the contractor will see this)
                  </label>
                  <input
                    id={`reason-${p.id}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(p, { action: 'hide', note: reason })}
                      disabled={busyId === p.id || reason.trim().length === 0}
                      className="px-4 py-2 text-sm rounded-[4px] bg-danger text-paper disabled:opacity-50"
                    >
                      Hide project
                    </button>
                    <button
                      onClick={() => {
                        setHidingId(null);
                        setReason('');
                      }}
                      className="px-4 py-2 text-sm rounded-[4px] border border-line text-stone hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {p.approvalStatus !== 'APPROVED' && (
                    <button
                      onClick={() => act(p, { action: 'approve' })}
                      disabled={busyId === p.id}
                      className="px-4 py-2 text-sm rounded-[4px] bg-ink text-paper disabled:opacity-50"
                    >
                      {p.approvalStatus === 'HIDDEN' ? 'Restore (make public)' : 'Approve'}
                    </button>
                  )}
                  {p.approvalStatus !== 'HIDDEN' && (
                    <button
                      onClick={() => {
                        setHidingId(p.id);
                        setReason('');
                      }}
                      className="px-4 py-2 text-sm rounded-[4px] border border-line text-stone hover:text-ink"
                    >
                      {p.approvalStatus === 'APPROVED' ? 'Take down...' : 'Hide...'}
                    </button>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
