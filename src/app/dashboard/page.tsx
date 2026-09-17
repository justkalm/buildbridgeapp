// src/app/dashboard/page.tsx

'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import MessageThread from '@/components/MessageThread';

type QuoteRequestRow = {
  id: string;
  projectType: string;
  location: string;
  status: 'PENDING' | 'CONTACTED' | 'DECLINED';
  createdAt: string;
  emailSentAt: string | null;
  contractor: { id: string; name: string; slug: string };
};

type ShortlistedRow = {
  id: string;
  note: string | null;
  createdAt: string;
  contractor: {
    id: string;
    slug: string;
    name: string;
    city: string;
    area: string;
    tradeTypes: string[];
    verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
    yearsInBusiness: number | null;
    rating: number;
    reviewCount: number;
    _count: { projects: number };
  };
};

const statusLabel: Record<QuoteRequestRow['status'], string> = {
  PENDING: 'Awaiting response',
  CONTACTED: 'Contractor reached out',
  DECLINED: 'No response',
};

const statusStyle: Record<QuoteRequestRow['status'], string> = {
  PENDING: 'bg-sage-soft text-sage',
  CONTACTED: 'bg-sage-soft text-sage',
  DECLINED: 'bg-paper-dim text-stone',
};

export default function DashboardPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<QuoteRequestRow[] | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistedRow[] | null>(null);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
    // Previously missing entirely — every other role-specific page
    // (post-project, contractor/*) redirects a wrong-role session to
    // their own home instead of rendering. Without this, a logged-in
    // contractor who navigated here directly (bookmark, typed URL) saw a
    // confusing dashboard that never populated with real data — the
    // underlying API (/api/quote-requests/mine) was always correctly
    // role-gated server-side, so nothing leaked, but the UX was a dead
    // end with no data and no explanation.
    if (
      status === 'authenticated' &&
      (session?.user as { role?: string })?.role !== 'developer'
    ) {
      router.push('/contractor/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/quote-requests/mine')
      .then((res) => (res.ok ? res.json() : []))
      .then(setRequests);
    fetch('/api/developers/shortlist')
      .then((res) => (res.ok ? res.json() : []))
      .then(setShortlist);
  }, [status]);

  async function removeFromShortlist(contractorId: string) {
    setShortlist((prev) => (prev ? prev.filter((s) => s.contractor.id !== contractorId) : prev));
    await fetch(`/api/developers/shortlist/${contractorId}`, { method: 'DELETE' });
  }

  function startEditingNote(entry: ShortlistedRow) {
    setEditingNoteFor(entry.contractor.id);
    setNoteDraft(entry.note ?? '');
  }

  async function saveNote(contractorId: string) {
    setSavingNote(true);
    const res = await fetch('/api/developers/shortlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractorId, note: noteDraft.trim() || undefined }),
    });
    if (res.ok) {
      const updated = await res.json();
      setShortlist((prev) =>
        prev ? prev.map((s) => (s.contractor.id === contractorId ? { ...s, note: updated.note } : s)) : prev
      );
      setEditingNoteFor(null);
    }
    setSavingNote(false);
  }

  if (
    status !== 'authenticated' ||
    (session?.user as { role?: string })?.role !== 'developer'
  ) {
    return null;
  }

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[1440px] mx-auto px-8 py-10 w-full">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-9">
          <div>
            <h1 className="font-display font-light text-[28px] mb-1">Your Quotation Requests</h1>
            <p className="text-stone text-[14.5px]">Every request you&apos;ve sent, and its status.</p>
          </div>
          <Link
            href="/browse"
            className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
          >
            Browse Contractors
          </Link>
        </div>

        {shortlist !== null && shortlist.length > 0 && (
          <>
            <h2 className="font-display font-light text-xl mb-4">Your shortlist</h2>
            <div className="flex flex-col gap-3 mb-6">
              {shortlist.map((s) => (
                <div key={s.id} className="border border-line rounded-[6px] p-4 bg-paper">
                  <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                    <Link
                      href={`/contractors/${s.contractor.slug}`}
                      className="font-medium text-sm hover:text-stone transition-colors"
                    >
                      {s.contractor.name}
                    </Link>
                    <button
                      onClick={() => removeFromShortlist(s.contractor.id)}
                      className="text-xs text-stone hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-xs text-stone mb-2">
                    {s.contractor.area}, {s.contractor.city} · {s.contractor.tradeTypes.join(', ')}
                  </p>
                  {editingNoteFor === s.contractor.id ? (
                    <div className="flex gap-2 items-start">
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        rows={2}
                        placeholder="Private note — only you can see this"
                        className="flex-1 text-sm px-3 py-2 border border-line rounded-[4px] bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                      />
                      <button
                        onClick={() => saveNote(s.contractor.id)}
                        disabled={savingNote}
                        className="text-xs font-medium px-3 py-2 rounded-full bg-ink text-paper disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  ) : s.note ? (
                    <button
                      onClick={() => startEditingNote(s)}
                      className="text-xs text-stone text-left hover:text-ink transition-colors"
                    >
                      &quot;{s.note}&quot; <span className="underline underline-offset-2">Edit</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditingNote(s)}
                      className="text-xs text-stone underline underline-offset-2 hover:text-ink transition-colors"
                    >
                      + Add a private note
                    </button>
                  )}
                </div>
              ))}
            </div>

            {shortlist.length >= 2 && (
              <>
                <h3 className="font-display text-lg mb-3">Compare</h3>
                <div className="bg-paper border border-line rounded-md overflow-hidden mb-10 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] tracking-wider uppercase text-stone">
                        <th className="px-4 py-3 border-b border-line">Contractor</th>
                        <th className="px-4 py-3 border-b border-line">Trades</th>
                        <th className="px-4 py-3 border-b border-line">Location</th>
                        <th className="px-4 py-3 border-b border-line">Experience</th>
                        <th className="px-4 py-3 border-b border-line">Projects</th>
                        <th className="px-4 py-3 border-b border-line">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shortlist.map((s) => (
                        <tr key={s.id} className="border-b border-line last:border-b-0">
                          <td className="px-4 py-3">
                            <Link href={`/contractors/${s.contractor.slug}`} className="font-medium hover:text-stone transition-colors">
                              {s.contractor.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-stone">{s.contractor.tradeTypes.join(', ')}</td>
                          <td className="px-4 py-3 text-stone">{s.contractor.area}, {s.contractor.city}</td>
                          <td className="px-4 py-3 text-stone">
                            {s.contractor.yearsInBusiness ? `${s.contractor.yearsInBusiness}+ years` : '—'}
                          </td>
                          <td className="px-4 py-3 text-stone">{s.contractor._count.projects}</td>
                          <td className="px-4 py-3 text-stone">
                            {s.contractor.reviewCount > 0 ? `${s.contractor.rating.toFixed(1)} (${s.contractor.reviewCount})` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {requests === null ? (
          <p className="text-sm text-stone">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="border border-line rounded-md p-10 text-center bg-paper">
            <p className="text-stone font-medium mb-1">No quote requests yet</p>
            <p className="text-sm text-stone mb-4">Browse contractors and request a quote to get started.</p>
            <Link href="/browse" className="text-ink font-medium text-sm">
              Browse Contractors →
            </Link>
          </div>
        ) : (
          <div className="bg-paper border border-line rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] tracking-wider uppercase text-stone">
                  <th className="px-4 py-3 border-b border-line">Contractor</th>
                  <th className="px-4 py-3 border-b border-line">Project</th>
                  <th className="px-4 py-3 border-b border-line">Sent</th>
                  <th className="px-4 py-3 border-b border-line">Status</th>
                  <th className="px-4 py-3 border-b border-line"></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <React.Fragment key={r.id}>
                  <tr className="border-b border-line last:border-b-0">
                    <td className="px-4 py-4">
                      <Link href={`/contractors/${r.contractor.slug}`} className="font-medium hover:text-stone transition-colors">
                        {r.contractor.name}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-stone">
                      {r.projectType} · {r.location}
                    </td>
                    <td className="px-4 py-4 text-stone">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block text-[11.5px] font-medium px-2.5 py-1 rounded-full ${statusStyle[r.status]}`}>
                        {statusLabel[r.status]}
                      </span>
                      {!r.emailSentAt && (
                        <p className="text-[11px] text-red-600 mt-1">
                          Notification may not have been delivered
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => setExpandedMessageId(expandedMessageId === r.id ? null : r.id)}
                        className="text-xs text-stone underline underline-offset-2 hover:text-ink transition-colors"
                      >
                        Message
                      </button>
                    </td>
                  </tr>
                  {expandedMessageId === r.id && (
                    <tr className="border-b border-line last:border-b-0 bg-paper-dim/40">
                      <td colSpan={5} className="px-4 py-4">
                        <MessageThread quoteRequestId={r.id} viewerRole="DEVELOPER" startOpen />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
