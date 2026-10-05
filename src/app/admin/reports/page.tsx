// src/app/admin/reports/page.tsx
//
// The Reports desk (KALM-255). Reports from the public "Report" links wait
// here, oldest first. For each one the admin writes what they decided and
// why, then closes it as Actioned or Dismissed; a project report also offers
// "Hide project and close", which takes the project down first. Closing needs
// a note, and every closure is written to the moderation log. A message report
// shows only the conversation id: read the thread deliberately from the
// Messages page, never from here.

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import AdminTabs from '@/components/AdminTabs';
import { reasonLabel } from '@/lib/reports';

type ReportRow = {
  id: string;
  targetType: 'CONTRACTOR' | 'PROJECT' | 'MESSAGE' | 'OTHER' | 'PROJECT_POST';
  targetId: string | null;
  reason: string;
  details: string | null;
  reporterEmail: string | null;
  reporterRole: string | null;
  status: 'OPEN' | 'ACTIONED' | 'DISMISSED';
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    approvalStatus: 'PENDING' | 'APPROVED' | 'HIDDEN';
    contractorName: string;
    imageUrls: string[];
  } | null;
  contractor: { name: string; slug: string } | null;
  targetGone: boolean;
};

type View = 'OPEN' | 'ACTIONED' | 'DISMISSED';
const VIEWS: { key: View; label: string; empty: string }[] = [
  { key: 'OPEN', label: 'Open', empty: 'No open reports.' },
  { key: 'ACTIONED', label: 'Actioned', empty: 'Nothing actioned yet.' },
  { key: 'DISMISSED', label: 'Dismissed', empty: 'Nothing dismissed yet.' },
];

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminReportsPage() {
  const [view, setView] = useState<View>('OPEN');
  const [items, setItems] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Fetch only: state is set in the callbacks (see the review page).
  function fetchView(v: View) {
    fetch(`/api/admin/reports?status=${v}`)
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

  async function send(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, error: (data.error as string | undefined) ?? 'Something went wrong' };
  }

  async function close(r: ReportRow, status: 'ACTIONED' | 'DISMISSED', hideProject: boolean) {
    const note = (notes[r.id] ?? '').trim();
    if (!note) {
      setError('Please write what you decided and why.');
      return;
    }
    setBusyId(r.id);
    setError(null);
    try {
      if (hideProject && r.project) {
        const hidden = await send(`/api/admin/projects/${r.project.id}/moderate`, { action: 'hide', note });
        if (!hidden.ok) {
          setError(hidden.error);
          return;
        }
      }
      const closed = await send(`/api/admin/reports/${r.id}`, {
        status,
        note: hideProject ? `Project hidden. ${note}` : note,
      });
      if (!closed.ok) {
        setError(closed.error);
        // The project may already be hidden: reload so the page tells the truth.
        setItems(null);
        fetchView(view);
        return;
      }
      setItems((prev) => (prev ? prev.filter((x) => x.id !== r.id) : prev));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-paper py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <AdminTabs active="reports" />
        <h1 className="font-display font-bold text-2xl tracking-tight mb-1">Reports</h1>
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
          {items === null ? 'Loading...' : `${items.length} report${items.length === 1 ? '' : 's'}.`}
        </p>

        {error && (
          <div className="bg-danger-soft border border-danger/30 text-danger text-sm rounded-md p-4 mb-6">{error}</div>
        )}

        {items && items.length === 0 && (
          <p className="text-sm text-stone border border-line rounded-md p-6">{VIEWS.find((v) => v.key === view)?.empty}</p>
        )}

        <div className="flex flex-col gap-5">
          {items?.map((r) => (
            <section key={r.id} className="border border-line rounded-md p-5 bg-paper">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                <h2 className="font-medium">{reasonLabel(r.reason)}</h2>
                <span className="text-xs text-stone">{when(r.createdAt)}</span>
              </div>

              <p className="text-sm text-stone mb-1">
                {r.project && `Project "${r.project.title}" by ${r.project.contractorName} (${r.project.approvalStatus.toLowerCase()})`}
                {r.contractor && `Contractor profile: ${r.contractor.name}`}
                {r.targetType === 'MESSAGE' && 'A message conversation'}
                {r.targetType === 'OTHER' && 'A general report'}
                {r.targetGone && 'The reported item no longer exists.'}
              </p>
              {r.targetType === 'MESSAGE' && r.targetId && (
                <p className="text-xs text-stone mb-1">
                  Conversation id: <span className="font-mono">{r.targetId}</span>. To read it, open the Messages tab and
                  paste this id.
                </p>
              )}
              <p className="text-xs text-stone mb-3">
                Reported by {r.reporterEmail ?? 'unknown'}
                {r.reporterRole ? ` (${r.reporterRole})` : ' (not logged in)'}
              </p>

              {r.details && (
                <p className="text-sm whitespace-pre-wrap bg-paper-dim rounded-md p-3 mb-3">{r.details}</p>
              )}

              {r.project && r.project.imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {r.project.imageUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" title="Open full size">
                      <Image
                        src={url}
                        alt={`Photo from ${r.project?.title}`}
                        width={120}
                        height={120}
                        className="w-28 h-28 rounded-md object-cover border border-line"
                      />
                    </a>
                  ))}
                </div>
              )}

              {r.status === 'OPEN' ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor={`note-${r.id}`} className="text-xs text-stone">
                    What did you decide, and why? (kept on record)
                  </label>
                  <input
                    id={`note-${r.id}`}
                    value={notes[r.id] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    maxLength={900}
                    className="w-full px-3 py-2 border border-line rounded-[4px] text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                  <div className="flex flex-wrap gap-2">
                    {r.project && r.project.approvalStatus !== 'HIDDEN' && (
                      <button
                        onClick={() => close(r, 'ACTIONED', true)}
                        disabled={busyId === r.id}
                        className="px-4 py-2 text-sm rounded-[4px] bg-danger text-paper disabled:opacity-50"
                      >
                        Hide project and close
                      </button>
                    )}
                    <button
                      onClick={() => close(r, 'ACTIONED', false)}
                      disabled={busyId === r.id}
                      className="px-4 py-2 text-sm rounded-[4px] bg-ink text-paper disabled:opacity-50"
                    >
                      Close as actioned
                    </button>
                    <button
                      onClick={() => close(r, 'DISMISSED', false)}
                      disabled={busyId === r.id}
                      className="px-4 py-2 text-sm rounded-[4px] border border-line text-stone hover:text-ink disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-stone">
                  {r.status === 'ACTIONED' ? 'Actioned' : 'Dismissed'}
                  {r.resolvedAt ? ` on ${when(r.resolvedAt)}` : ''}. {r.resolutionNote}
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
