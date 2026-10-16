// src/app/admin/applications/page.tsx
//
// The contractor onboarding forms sent in through /join. Admin reads each
// one, then presses "Add as contractor", which opens Add a Contractor with
// everything prefilled (?from=<id>) and marks the form Added once that
// listing is saved. "Not taking forward" marks it Rejected. Nothing on this
// page changes the live directory by itself.

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AdminTabs from '@/components/AdminTabs';
import { specialityLabel } from '@/lib/trade-types';

type Status = 'NEW' | 'ADDED' | 'REJECTED';

type ApplicationRow = {
  id: string;
  businessName: string;
  phone: string;
  email: string;
  area: string;
  bio: string | null;
  logoUrl: string | null;
  tradeTypes: string[];
  gstNumber: string | null;
  licenceNumber: string | null;
  projects: { name: string; developerName?: string; imageUrls: string[] }[];
  status: Status;
  adminNote: string | null;
  createdAt: string;
};

const statusLabel: Record<Status, string> = { NEW: 'New', ADDED: 'Added', REJECTED: 'Not taken forward' };
const statusStyle: Record<Status, string> = {
  NEW: 'bg-ink text-paper',
  ADDED: 'bg-sage-soft text-sage',
  REJECTED: 'bg-paper-dim text-stone',
};

export default function AdminApplicationsPage() {
  const [rows, setRows] = useState<ApplicationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | 'ALL'>('NEW');
  const [busyId, setBusyId] = useState<string | null>(null);
  // The form whose "Delete for good?" question is showing (asked in the
  // card, not a browser pop-up).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/applications')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setRows)
      .catch(() => setError('Failed to load the forms. Your admin session may have expired.'));
  }, []);

  async function setStatus(id: string, status: Status) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setRows((all) => all?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null);
    } catch {
      setError('Could not update that form. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteForGood(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error);
      }
      setRows((all) => all?.filter((r) => r.id !== id) ?? null);
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not delete that form. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  const shown = rows?.filter((r) => filter === 'ALL' || r.status === filter) ?? [];
  const countOf = (s: Status) => rows?.filter((r) => r.status === s).length ?? 0;

  return (
    <main className="min-h-screen bg-paper-dim py-10 px-6">
      <div className="max-w-3xl mx-auto">
        <AdminTabs active="applications" />
        <h1 className="font-display font-light text-2xl mb-1">Join forms</h1>
        <p className="text-stone text-sm mb-6">
          Details contractors sent through the link <span className="font-medium text-ink">/join</span>.
          Check them, then add the listing. Nothing here is public.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {(['NEW', 'ADDED', 'REJECTED', 'ALL'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`text-sm px-3 py-1.5 rounded-full border ${
                filter === key ? 'border-ink bg-ink text-paper' : 'border-line bg-white text-stone hover:text-ink'
              }`}
            >
              {key === 'ALL' ? `All (${rows?.length ?? 0})` : `${statusLabel[key]} (${countOf(key)})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-danger-soft border border-danger text-danger text-sm rounded-md p-3.5 mb-5">{error}</div>
        )}
        {rows === null && !error && <p className="text-sm text-stone">Loading…</p>}
        {rows !== null && shown.length === 0 && <p className="text-sm text-stone">No forms here.</p>}

        <div className="flex flex-col gap-4">
          {shown.map((r) => (
            <article key={r.id} className="bg-white border border-line rounded-md p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {r.logoUrl && (
                    <Image src={r.logoUrl} alt="" width={48} height={48}
                      className="w-12 h-12 rounded-md object-cover border border-line shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h2 className="font-display font-semibold text-lg truncate">{r.businessName}</h2>
                    <p className="text-xs text-stone">
                      {r.area}, sent {new Date(r.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${statusStyle[r.status]}`}>
                  {statusLabel[r.status]}
                </span>
              </div>

              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm mb-3">
                <dt className="text-stone">Phone</dt><dd>{r.phone}</dd>
                <dt className="text-stone">Email</dt><dd className="break-all">{r.email}</dd>
                <dt className="text-stone">GST</dt><dd>{r.gstNumber ?? 'Not given'}</dd>
                <dt className="text-stone">Licence</dt><dd>{r.licenceNumber ?? 'Not given'}</dd>
                <dt className="text-stone">Specialities</dt>
                <dd>{r.tradeTypes.map(specialityLabel).join(', ')}</dd>
              </dl>
              {r.bio && <p className="text-sm text-stone whitespace-pre-wrap mb-3">{r.bio}</p>}

              {r.projects.length > 0 && (
                <div className="flex flex-col gap-3 mb-4">
                  {r.projects.map((p, i) => (
                    <div key={i} className="border-t border-line pt-3">
                      <p className="text-sm font-medium">
                        {p.name}
                        {p.developerName && <span className="text-stone font-normal"> for {p.developerName}</span>}
                      </p>
                      {p.imageUrls.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {p.imageUrls.map((url) => (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                              <Image src={url} alt="" width={80} height={80}
                                className="w-20 h-20 rounded-md object-cover border border-line" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone mt-1">No photos</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3 border-t border-line">
                {r.status !== 'ADDED' && (
                  <Link href={`/admin/contractors/new?from=${r.id}`}
                    className="text-sm font-medium bg-ink text-paper rounded-full px-4 py-2 hover:bg-stone">
                    Add as contractor
                  </Link>
                )}
                {r.status === 'NEW' && (
                  <button type="button" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'REJECTED')}
                    className="text-sm border border-line rounded-full px-4 py-2 hover:border-ink disabled:opacity-60">
                    Not taking forward
                  </button>
                )}
                {r.status !== 'NEW' && (
                  <button type="button" disabled={busyId === r.id} onClick={() => setStatus(r.id, 'NEW')}
                    className="text-sm border border-line rounded-full px-4 py-2 hover:border-ink disabled:opacity-60">
                    Move back to New
                  </button>
                )}
                {confirmDeleteId !== r.id && (
                  <button type="button" onClick={() => setConfirmDeleteId(r.id)}
                    className="text-sm text-danger px-2 py-2 ml-auto">
                    Delete
                  </button>
                )}
              </div>
              {confirmDeleteId === r.id && (
                <div className="mt-3 bg-danger-soft border border-danger rounded-md p-3 text-sm">
                  <p className="mb-2">
                    Delete this form and its logo and photos for good? This can&apos;t be undone.
                    {r.status === 'ADDED' && ' Photos its listing still shows are kept.'}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" disabled={busyId === r.id} onClick={() => deleteForGood(r.id)}
                      className="text-sm font-medium bg-danger text-paper rounded-full px-4 py-1.5 disabled:opacity-60">
                      Yes, delete
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)}
                      className="text-sm border border-line bg-white rounded-full px-4 py-1.5">
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
