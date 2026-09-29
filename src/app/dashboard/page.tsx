// src/app/dashboard/page.tsx
//
// Developer home: shortlist (with private notes + compare table) and every
// quote request they've sent, with its status and a link to its conversation
// in Messages (/messages/{id}). Requests are stacked cards below md and a
// horizontally scrollable table from md up.
//
// Status wording comes from src/lib/quote-status.ts so it always matches
// what the contractor's dashboard and the status-change email say.
//
// Email-verification banner: when the verification switch is on (see
// src/lib/require-verified-email.ts), quote requests, project posts and
// site visits are blocked until the developer's email is verified, so this
// page (where those forms' "verify your email" errors link to) shows a
// banner with a resend button. While the switch is off, no banner.

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import Skeleton from '@/components/Skeleton';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import PushPrompt from '@/components/PushPrompt';
import SiteVisitList from '@/components/SiteVisitList';
import { developerStatusLabel, type QuoteStatus } from '@/lib/quote-status';
import { announceNotificationsChanged, useUnreadMessages } from '@/lib/use-unread-messages';

type QuoteRequestRow = {
  id: string;
  projectType: string;
  location: string;
  status: QuoteStatus;
  statusUpdatedAt: string | null;
  createdAt: string;
  emailSentAt: string | null;
  // Status changed since the developer last looked (see
  // /api/quote-requests/mine). Shows a "New" label once.
  isNew: boolean;
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

const statusStyle: Record<QuoteStatus, string> = {
  PENDING: 'bg-paper-dim text-stone',
  CONTACTED: 'bg-sage-soft text-sage',
  QUOTED: 'bg-ink text-paper',
  DECLINED: 'bg-paper-dim text-stone line-through decoration-stone/40',
};

type Me = { name: string; email: string; emailVerified: boolean; verificationRequired: boolean };

export default function DashboardPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<QuoteRequestRow[] | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistedRow[] | null>(null);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | string>('idle');
  const isDeveloper = status === 'authenticated' && (session?.user as { role?: string })?.role === 'developer';
  const unread = useUnreadMessages(isDeveloper, 30_000);

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
      .then((rows: QuoteRequestRow[]) => {
        setRequests(rows);
        if (rows.some((r) => r.isNew)) announceNotificationsChanged();
      });
    fetch('/api/developers/shortlist')
      .then((res) => (res.ok ? res.json() : []))
      .then(setShortlist);
    fetch('/api/developers/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(setMe);
  }, [status]);

  async function resendVerification() {
    setResendState('sending');
    try {
      const res = await fetch('/api/developers/resend-verification', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        if (data?.alreadyVerified) setMe((prev) => (prev ? { ...prev, emailVerified: true } : prev));
        setResendState('sent');
      } else {
        setResendState(data?.error ?? "Couldn't send the email. Please try again.");
      }
    } catch {
      setResendState("Couldn't send. Please check your connection and try again.");
    }
  }

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
      <main className="flex-1 max-w-[1440px] mx-auto px-5 sm:px-8 py-10 w-full">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-9">
          <div>
            <h1 className="font-display font-light text-[28px] mb-1">Your dashboard</h1>
            <p className="text-stone text-[14.5px]">
              Contractors you&apos;ve saved, your site visits, and every quote request you&apos;ve sent.
            </p>
          </div>
          <Link
            href="/browse"
            className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
          >
            Browse Contractors
          </Link>
        </div>

        {me && me.verificationRequired && !me.emailVerified && (
          <div className="mb-8 px-4 py-3 rounded-[6px] bg-paper-dim text-sm flex flex-wrap items-center justify-between gap-3">
            <p className="text-stone">
              Please verify your email ({me.email}) to request quotes and post projects. Check your
              inbox for the link we sent when you signed up.
            </p>
            {resendState === 'sent' ? (
              <span className="text-xs text-sage font-medium">New link sent. Check your inbox.</span>
            ) : (
              <button
                onClick={resendVerification}
                disabled={resendState === 'sending'}
                className="text-xs font-medium px-4 py-2 rounded-full bg-ink text-paper disabled:opacity-60"
              >
                {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
            {resendState !== 'idle' && resendState !== 'sending' && resendState !== 'sent' && (
              <p className="w-full text-xs text-danger">{resendState}</p>
            )}
          </div>
        )}

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
                      className="text-xs text-stone hover:text-danger transition-colors"
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
                        placeholder="Private note (only you can see this)"
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
                {/* Outer box owns the rounded border and clips the corners; the
                    inner box scrolls sideways on phones. One element doing both
                    overflow-hidden and overflow-x-auto was redundant. */}
                <div className="bg-paper border border-line rounded-md overflow-hidden mb-10">
                  <div className="overflow-x-auto">
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
                            {s.contractor.yearsInBusiness ? `${s.contractor.yearsInBusiness}+ years` : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-stone">{s.contractor._count.projects}</td>
                          <td className="px-4 py-3 text-stone">
                            {s.contractor.reviewCount > 0 ? `${s.contractor.rating.toFixed(1)} (${s.contractor.reviewCount})` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <InstallAppPrompt />
        <PushPrompt />

        <SiteVisitList viewerRole="DEVELOPER" />

        <h2 className="font-display font-light text-xl mb-4">Your quote requests</h2>
        {requests === null ? (
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Loading…</span>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : requests.length === 0 ? (
          <div className="border border-line rounded-md p-10 text-center bg-paper">
            <p className="text-stone font-medium mb-1">No quote requests yet</p>
            <p className="text-sm text-stone mb-4">Browse contractors and request a quote to get started.</p>
            <Link href="/browse" className="text-ink font-medium text-sm">
              Browse Contractors →
            </Link>
          </div>
        ) : (
          <>
            <ul className="md:hidden flex flex-col gap-3">
              {requests.map((r) => (
                <li key={r.id} className="border border-line rounded-[6px] p-4 bg-paper">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <Link href={`/contractors/${r.contractor.slug}`} className="font-medium text-sm hover:text-stone transition-colors">
                      {r.contractor.name}
                    </Link>
                    <span className="shrink-0">
                      {r.isNew && (
                        <span className="inline-block mr-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-ink text-paper">
                          New
                        </span>
                      )}
                      <span className={`inline-block text-[11.5px] font-medium px-2.5 py-1 rounded-full ${statusStyle[r.status]}`}>
                        {developerStatusLabel[r.status]}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-stone">
                    {r.projectType} · {r.location}
                  </p>
                  <p className="text-xs text-stone mt-0.5">Sent {new Date(r.createdAt).toLocaleDateString()}</p>
                  {r.statusUpdatedAt && (
                    <p className="text-[11px] text-stone mt-0.5">
                      Updated {new Date(r.statusUpdatedAt).toLocaleDateString()}
                    </p>
                  )}
                  {!r.emailSentAt && (
                    <p className="text-[11px] text-danger mt-1">Notification may not have been delivered</p>
                  )}
                  <div className="mt-3">
                    <ConversationLink id={r.id} count={unread.byQuoteRequest[r.id]} block />
                  </div>
                </li>
              ))}
            </ul>

            {/* Wrapper scrolls sideways rather than clipping, so the last
                column stays reachable on narrow tablets. */}
            <div className="hidden md:block bg-paper border border-line rounded-md overflow-x-auto">
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
                    <tr key={r.id} className="border-b border-line last:border-b-0">
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
                        {r.isNew && (
                          <span className="inline-block mr-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-ink text-paper">
                            New
                          </span>
                        )}
                        <span className={`inline-block text-[11.5px] font-medium px-2.5 py-1 rounded-full ${statusStyle[r.status]}`}>
                          {developerStatusLabel[r.status]}
                        </span>
                        {r.statusUpdatedAt && (
                          <p className="text-[11px] text-stone mt-1">
                            Updated {new Date(r.statusUpdatedAt).toLocaleDateString()}
                          </p>
                        )}
                        {!r.emailSentAt && (
                          <p className="text-[11px] text-danger mt-1">
                            Notification may not have been delivered
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <ConversationLink id={r.id} count={unread.byQuoteRequest[r.id]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

// "Open conversation" link to the request's thread in Messages, with the
// unread count badge from useUnreadMessages next to it.
function ConversationLink({ id, count, block }: { id: string; count?: number; block?: boolean }) {
  return (
    <Link
      href={`/messages/${id}`}
      className={`${block ? 'flex w-full justify-center' : 'inline-flex'} items-center gap-2 text-xs font-medium px-4 py-2 rounded-full border border-line text-ink hover:border-ink transition-colors`}
    >
      Open conversation
      {count !== undefined && count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-paper text-[10.5px] font-semibold">
          {count}
          <span className="sr-only"> unread</span>
        </span>
      )}
    </Link>
  );
}
