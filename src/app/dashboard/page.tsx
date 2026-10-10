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
import PostedProjectsSection from '@/components/PostedProjectsSection';
import SavedProjectsSection from '@/components/SavedProjectsSection';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import Skeleton from '@/components/Skeleton';
import AlertsStrip from '@/components/AlertsStrip';
import SiteVisitList from '@/components/SiteVisitList';
import { developerStatusLabel, type QuoteStatus } from '@/lib/quote-status';
import { announceNotificationsChanged, useUnreadMessages } from '@/lib/use-unread-messages';
import { tradesOf } from '@/lib/trade-types';

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

type TabId = 'requests' | 'shortlist' | 'projects' | 'visits';

// Same tab style as the contractor dashboard: one section at a time, each
// with a count of new items, instead of one long page to scroll.
const TABS: { id: TabId; label: string; hash: string }[] = [
  { id: 'requests', label: 'Quote requests', hash: '' },
  { id: 'shortlist', label: 'Shortlist', hash: '#shortlist' },
  { id: 'projects', label: 'Your projects', hash: '#projects' },
  { id: 'visits', label: 'Site visits', hash: '#site-visits' },
];

// Site-visit emails and pop-ups link to /dashboard#site-visits; the other
// tabs have their own address too, so a refresh stays on the same tab.
function tabFromHash(): TabId {
  if (typeof window === 'undefined') return 'requests';
  return TABS.find((t) => t.hash && t.hash === window.location.hash)?.id ?? 'requests';
}

export default function DashboardPage() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<QuoteRequestRow[] | null>(null);
  const [shortlist, setShortlist] = useState<ShortlistedRow[] | null>(null);
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  // The page renders nothing until the session has loaded (below), so
  // reading the address bar here can't cause a hydration mismatch.
  const [tab, setTab] = useState<TabId>(tabFromHash);

  function selectTab(id: TabId) {
    setTab(id);
    const hash = TABS.find((t) => t.id === id)?.hash ?? '';
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
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

  const tabCounts: Record<TabId, number> = {
    requests: (requests ?? []).filter((r) => r.isNew || (unread.byQuoteRequest[r.id] ?? 0) > 0).length,
    shortlist: 0,
    projects: 0,
    visits: unread.siteVisits,
  };

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

        {/* One slim line instead of two cards, as on the contractor dashboard. */}
        <AlertsStrip audience="developer" />

        <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 border-b border-line mb-6 overflow-x-auto">
          {TABS.map((t) => {
            const count = tabCounts[t.id];
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                onClick={() => selectTab(t.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  active ? 'border-ink text-ink font-medium' : 'border-transparent text-stone hover:text-ink'
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-paper text-[11px] font-semibold inline-flex items-center justify-center">
                    {count}
                    <span className="sr-only"> new</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id="panel-shortlist" aria-labelledby="tab-shortlist" hidden={tab !== 'shortlist'}>
        {shortlist !== null && shortlist.length === 0 && (
          <p className="text-sm text-stone">
            No contractors shortlisted yet. Save contractors from{' '}
            <Link href="/browse" className="underline underline-offset-2 hover:text-ink">Browse</Link> to compare them
            side by side.
          </p>
        )}
        {shortlist !== null && shortlist.length > 0 && (
          <>
            <h2 className="font-display font-light text-xl mb-1">Your shortlist</h2>
            <p className="text-sm text-stone mb-4">
              Every contractor you save is compared here side by side. Notes are private: only you can see them.
            </p>
            {/* One table is the whole shortlist (owner, 2 Oct): saving a
                contractor puts them straight into the comparison, notes are
                written in the table, and with only one saved a second row
                invites adding more. The outer box owns the rounded border and
                clips the corners; the inner box scrolls sideways on phones. */}
            <div className="bg-paper border border-line rounded-md overflow-hidden mb-10">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] tracking-wider uppercase text-stone">
                    <th className="px-4 py-3 border-b border-line">Contractor</th>
                    <th className="px-4 py-3 border-b border-line">Your note</th>
                    <th className="px-4 py-3 border-b border-line">Trades</th>
                    <th className="px-4 py-3 border-b border-line">Location</th>
                    <th className="px-4 py-3 border-b border-line">Experience</th>
                    <th className="px-4 py-3 border-b border-line">Projects</th>
                  </tr>
                </thead>
                <tbody>
                  {shortlist.map((s) => (
                    <tr key={s.id} className="border-b border-line last:border-b-0 align-top">
                      <td className="px-4 py-3 min-w-[160px]">
                        <Link href={`/contractors/${s.contractor.slug}`} className="font-medium hover:text-stone transition-colors">
                          {s.contractor.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFromShortlist(s.contractor.id)}
                          className="block text-xs text-stone hover:text-danger transition-colors mt-1"
                        >
                          Remove
                        </button>
                      </td>
                      <td className="px-4 py-3 min-w-[200px]">
                        {editingNoteFor === s.contractor.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              rows={2}
                              autoFocus
                              aria-label={`Private note about ${s.contractor.name}`}
                              placeholder="Only you can see this"
                              className="text-sm px-3 py-2 border border-line rounded-[4px] bg-paper focus:outline-none focus:ring-2 focus:ring-ink"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveNote(s.contractor.id)}
                                disabled={savingNote}
                                className="text-xs font-medium px-3 py-1.5 rounded-full bg-ink text-paper disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingNoteFor(null)}
                                className="text-xs px-3 py-1.5 rounded-full border border-line hover:border-ink"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : s.note ? (
                          <button
                            type="button"
                            onClick={() => startEditingNote(s)}
                            className="text-xs text-stone text-left hover:text-ink transition-colors"
                          >
                            &quot;{s.note}&quot; <span className="underline underline-offset-2">Edit</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingNote(s)}
                            className="text-xs text-stone underline underline-offset-2 hover:text-ink transition-colors"
                          >
                            + Add a note
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone min-w-[160px]">{tradesOf(s.contractor.tradeTypes).join(', ')}</td>
                      <td className="px-4 py-3 text-stone min-w-[120px]">{s.contractor.area}, {s.contractor.city}</td>
                      <td className="px-4 py-3 text-stone whitespace-nowrap">
                        {s.contractor.yearsInBusiness ? `${s.contractor.yearsInBusiness}+ years` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-stone">{s.contractor._count.projects}</td>
                    </tr>
                  ))}
                  {shortlist.length === 1 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-stone">
                        Add more contractors to compare.{' '}
                        <Link href="/browse" className="underline underline-offset-2 hover:text-ink">
                          Browse contractors
                        </Link>{' '}
                        and tap save on the ones you like.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}

        </div>

        <div role="tabpanel" id="panel-projects" aria-labelledby="tab-projects" hidden={tab !== 'projects'}>
          <PostedProjectsSection />
          <SavedProjectsSection />
        </div>

        <div role="tabpanel" id="panel-visits" aria-labelledby="tab-visits" hidden={tab !== 'visits'}>
          <SiteVisitList viewerRole="DEVELOPER" />
        </div>

        <div role="tabpanel" id="panel-requests" aria-labelledby="tab-requests" hidden={tab !== 'requests'}>
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
        </div>
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
