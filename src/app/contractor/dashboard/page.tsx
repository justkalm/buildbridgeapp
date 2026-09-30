// src/app/contractor/dashboard/page.tsx
//
// Contractor's home base. Mirrors the client-side auth-guard pattern used
// by src/app/dashboard/page.tsx (developer dashboard): redirect on
// unauthenticated, render nothing until session is confirmed. The actual
// data fetch (GET /api/contractors/me) also checks the session server-side
// — this page-level guard is about UX (don't flash the page before
// redirecting), not the real security boundary.
//
// Each lead links to its conversation in Messages (/messages/{id}); the
// thread itself no longer renders inline.
//
// Quote request actions: each fully-visible lead shows Accept / Mark quote
// sent / Decline buttons for whichever moves are allowed from its current
// status (rules in src/lib/quote-status.ts; the server enforces the same
// rules in PATCH /api/quote-requests/[id]/status). Each change emails the
// developer. Decline asks for confirmation first, since it can't be
// undone and the developer is told straight away.

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AlertMessageButton from '@/components/AlertMessageButton';
import AlertsStrip from '@/components/AlertsStrip';
import SiteVisitList from '@/components/SiteVisitList';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import Skeleton from '@/components/Skeleton';
import {
  ALLOWED_TRANSITIONS,
  contractorActionLabel,
  contractorStatusLabel,
  type QuoteStatus,
} from '@/lib/quote-status';
import { announceNotificationsChanged, useUnreadMessages } from '@/lib/use-unread-messages';

type QuoteRequestRow = {
  id: string;
  projectType: string;
  location: string;
  budgetRangeLabel: string;
  details: string;
  status: QuoteStatus;
  createdAt: string;
  developer: { name: string; email: string | null; phone: string | null };
  leadVisibility: 'full' | 'blurred';
  // Not seen on this dashboard before this load (see GET
  // /api/contractors/me). Shows a "New" label once.
  isNew: boolean;
};

type ProjectAlertRow = {
  id: string;
  alertedAt: string;
  isNew: boolean;
  // Conversation this contractor already started from the alert, if any.
  conversationId: string | null;
  projectPost: {
    projectType: string;
    location: string;
    budgetRangeLabel: string;
    details: string;
    contactPhone: string;
    developer: { name: string; email: string };
  };
};

type ContractorMe = {
  id: string;
  name: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  tier: 'LISTED' | 'PLUS' | 'PRO';
  emailVerified: boolean;
  quoteRequests: QuoteRequestRow[];
  projectAlerts: ProjectAlertRow[];
  leadLimit: { cap: number; usedThisMonth: number } | null;
};

const verificationCopy: Record<ContractorMe['verificationStatus'], { label: string; style: string }> = {
  PENDING: { label: 'Verification pending', style: 'bg-paper-dim text-stone' },
  VERIFIED: { label: 'Verified', style: 'bg-sage-soft text-sage' },
  REJECTED: { label: 'Verification rejected', style: 'bg-danger-soft text-danger' },
};

const contractorStatusStyle: Record<QuoteStatus, string> = {
  PENDING: 'bg-ink text-paper',
  CONTACTED: 'bg-sage-soft text-sage',
  QUOTED: 'bg-sage-soft text-sage',
  DECLINED: 'bg-paper-dim text-stone',
};

const tierLabel: Record<ContractorMe['tier'], string> = {
  LISTED: 'Listed',
  PLUS: 'Plus',
  PRO: 'Pro',
};

type TabId = 'enquiries' | 'visits' | 'alerts';

const TABS: { id: TabId; label: string }[] = [
  { id: 'enquiries', label: 'Enquiries' },
  { id: 'visits', label: 'Site visits' },
  { id: 'alerts', label: 'Project alerts' },
];

// Site-visit emails and pop-ups link to /contractor/dashboard#site-visits.
function tabFromHash(): TabId {
  return typeof window !== 'undefined' && window.location.hash === '#site-visits' ? 'visits' : 'enquiries';
}

export default function ContractorDashboardPage() {
  const { status: sessionStatus, data: session } = useSession();
  const router = useRouter();
  const [me, setMe] = useState<ContractorMe | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<{ id: string; message: string } | null>(null);
  const isContractor =
    sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role === 'contractor';
  const unread = useUnreadMessages(isContractor, 30_000);
  // Tabs only render once the dashboard data has loaded (after the
  // skeleton), so reading the address bar here can't cause a hydration
  // mismatch.
  const [tab, setTab] = useState<TabId>(tabFromHash);

  function selectTab(id: TabId) {
    setTab(id);
    // Keep the address in step so a refresh stays on Site visits, without
    // adding a history entry per tap.
    const hash = id === 'visits' ? '#site-visits' : '';
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  async function changeStatus(r: QuoteRequestRow, next: Exclude<QuoteStatus, 'PENDING'>) {
    if (
      next === 'DECLINED' &&
      !window.confirm(`Mark ${r.developer.name}'s request as not interested? They'll be emailed, and this can't be undone.`)
    ) {
      return;
    }
    setUpdatingId(r.id);
    setStatusError(null);
    try {
      const res = await fetch(`/api/quote-requests/${r.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMe((prev) =>
          prev
            ? { ...prev, quoteRequests: prev.quoteRequests.map((q) => (q.id === r.id ? { ...q, status: next } : q)) }
            : prev
        );
      } else {
        setStatusError({ id: r.id, message: data?.error ?? "Couldn't update this request. Please try again." });
      }
    } catch {
      setStatusError({ id: r.id, message: "Couldn't update. Please check your connection and try again." });
    }
    setUpdatingId(null);
  }

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/login');
    }
    // A developer who somehow lands here shouldn't see contractor data.
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
      .then((data: ContractorMe | null) => {
        setMe(data);
        // Loading this page marked new requests/alerts as seen, so let the
        // Nav badge refresh now rather than on its next poll.
        if (data && (data.quoteRequests.some((r) => r.isNew) || data.projectAlerts.some((a) => a.isNew))) {
          announceNotificationsChanged();
        }
      });
  }, [sessionStatus]);

  if (sessionStatus !== 'authenticated' || !me) {
    // Previously returned null here — a fully blank white page (no Nav,
    // no Footer) during the session check and the me-fetch, unlike every
    // other dashboard/account page in the app which keeps the layout
    // mounted and shows a placeholder in the content area instead.
    // Keeping Nav/Footer up avoids the blank-flash; the grey Skeleton
    // shapes (a heading line and a few cards) hold the layout steady.
    return (
      <>
        <Nav />
        <main className="flex-1 max-w-[1440px] mx-auto px-5 sm:px-8 py-10 w-full">
          <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">Loading…</span>
            <Skeleton className="h-7 w-64 mb-4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const verification = verificationCopy[me.verificationStatus];
  const tabCounts: Record<TabId, number> = {
    enquiries: me.quoteRequests.filter((r) => r.isNew || (unread.byQuoteRequest[r.id] ?? 0) > 0).length,
    visits: unread.siteVisits,
    alerts: me.projectAlerts.filter((a) => a.isNew).length,
  };

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[1440px] mx-auto px-5 sm:px-8 py-10 w-full">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-display font-light text-[28px] mb-1">Welcome back, {me.name}</h1>
            {/* KALM-176: listing status and tier used to be two boxes of
                text; now one line, with the detail behind a tap. */}
            <p className="text-[14px] flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12.5px] font-medium ${verification.style}`}>
                {me.verificationStatus === 'VERIFIED' && <span aria-hidden>✓&nbsp;</span>}
                {verification.label}
              </span>
              <span className="text-stone">
                {tierLabel[me.tier]} · Free trial
              </span>
            </p>
            {me.verificationStatus !== 'PENDING' && (
              <details className="mt-1.5 text-xs text-stone max-w-[520px]">
                <summary className="cursor-pointer hover:text-ink select-none">What happens when I edit my profile?</summary>
                <p className="mt-1">
                  Your listing always stays live. Changing your location, phone, GST status or trades adds
                  &quot;update in review&quot; to your badge until we check it. Editing your bio, team details or
                  projects doesn&apos;t.
                </p>
              </details>
            )}
          </div>
          {/* KALM-174: "Data sharing" moved to the bottom of Edit profile. */}
          <nav className="flex gap-2 flex-wrap">
            <Link
              href="/contractor/profile"
              className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full border border-line hover:bg-paper-dim transition-colors"
            >
              Edit profile
            </Link>
            <Link
              href="/contractor/projects"
              className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full border border-line hover:bg-paper-dim transition-colors"
            >
              Manage projects
            </Link>
          </nav>
        </div>

        {!me.emailVerified && (
          <div className="mb-5 px-4 py-2.5 rounded-[6px] bg-paper-dim text-stone text-[13px]">
            Your email isn&apos;t verified yet. Check your inbox for a verification link.
          </div>
        )}

        <AlertsStrip audience="contractor" />

        {/* Tabs (owner's choice, 1 Oct): Enquiries, Site visits and Project
            alerts, each with a count of new items, so nothing needs
            scrolling past. Opens on Enquiries; #site-visits links (from
            site-visit emails and alerts) open that tab. */}
        <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 border-b border-line mb-5 overflow-x-auto">
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

        <div role="tabpanel" id="panel-enquiries" aria-labelledby="tab-enquiries" hidden={tab !== 'enquiries'}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="sr-only">Quote requests received</h2>
              <p className="text-xs text-stone mt-1">
                Tap <strong className="font-medium text-ink">Talking to them</strong>,{' '}
                <strong className="font-medium text-ink">Quote sent</strong> or{' '}
                <strong className="font-medium text-ink">Not interested</strong> to update an enquiry. The developer
                is told each time. Chats are in{' '}
                <Link href="/messages" className="underline underline-offset-2 hover:text-ink">
                  Messages
                </Link>
                .
              </p>
            </div>
            {me.leadLimit && (
              <span className="text-xs text-stone">
                {me.leadLimit.usedThisMonth} of {me.leadLimit.cap} full leads used this month
              </span>
            )}
          </div>
          {me.quoteRequests.length === 0 ? (
            <p className="text-stone text-sm">No quote requests yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {me.quoteRequests.map((r) =>
                r.leadVisibility === 'blurred' ? (
                  // The blurred details are still in the DOM (they're only visually
                  // blurred), so they are hidden from assistive tech and made inert
                  // (no focus, no find-in-page selection); the overlay's upgrade
                  // message stays readable and the card gets a plain label.
                  <div
                    key={r.id}
                    role="group"
                    aria-label={r.isNew ? 'New locked lead. Upgrade to see details.' : 'Locked lead. Upgrade to see details.'}
                    className="border border-line rounded-[6px] p-4 relative overflow-hidden"
                  >
                    {r.isNew && (
                      <span className="absolute top-3 right-3 z-10" aria-hidden="true">
                        <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-ink text-paper">New</span>
                      </span>
                    )}
                    <div aria-hidden="true" inert className="blur-[3px] select-none pointer-events-none">
                      <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                        <div>
                          <p className="font-medium text-sm">{r.developer.name}</p>
                          <p className="text-stone text-xs mt-0.5">
                            {r.projectType} · {r.location} · {r.budgetRangeLabel}
                          </p>
                        </div>
                        <span className="text-xs text-stone">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm mb-3">{r.details}</p>
                      <div className="flex gap-4 text-xs text-stone border-t border-line pt-2.5">
                        <span>contact@hidden.example</span>
                        <span>+91 00000 00000</span>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-paper/70">
                      <div className="text-center px-4">
                        <p className="text-sm font-medium mb-1">You&apos;ve used your free leads this month</p>
                        <p className="text-xs text-stone mb-3">
                          Upgrade to see full details for every lead, not just the first {me.leadLimit?.cap}.
                        </p>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center justify-center text-xs px-4 py-2 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
                        >
                          See upgrade options
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={r.id} className="border border-line rounded-[6px] p-4">
                    <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                      <div>
                        <p className="font-medium text-sm">{r.developer.name}</p>
                        <p className="text-stone text-xs mt-0.5">
                          {r.projectType} · {r.location} · {r.budgetRangeLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.isNew && <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-ink text-paper">New</span>}
                        <span
                          className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full ${contractorStatusStyle[r.status]}`}
                        >
                          {contractorStatusLabel[r.status]}
                        </span>
                        <span className="text-xs text-stone">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm mb-3">{r.details}</p>
                    <div className="flex gap-4 text-xs text-stone border-t border-line pt-2.5">
                      <a href={`mailto:${r.developer.email}`} className="hover:text-ink underline underline-offset-2">
                        {r.developer.email}
                      </a>
                      <a href={`tel:${r.developer.phone}`} className="hover:text-ink underline underline-offset-2">
                        {r.developer.phone}
                      </a>
                    </div>
                    {ALLOWED_TRANSITIONS[r.status].length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {ALLOWED_TRANSITIONS[r.status].map((next) => {
                          const action = next as Exclude<QuoteStatus, 'PENDING'>;
                          return (
                            <button
                              key={action}
                              onClick={() => changeStatus(r, action)}
                              disabled={updatingId === r.id}
                              className={
                                action === 'DECLINED'
                                  ? 'text-xs px-4 py-1.5 rounded-full border border-line text-stone hover:border-danger hover:text-danger transition-colors disabled:opacity-60'
                                  : 'text-xs px-4 py-1.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors disabled:opacity-60'
                              }
                            >
                              {contractorActionLabel[action]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {statusError?.id === r.id && (
                      <p className="text-[11px] text-danger mt-1.5">{statusError.message}</p>
                    )}
                    <Link
                      href={`/messages/${r.id}`}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full border border-line text-ink hover:border-ink transition-colors"
                    >
                      Open conversation
                      {unread.byQuoteRequest[r.id] > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-ink text-paper">
                          {unread.byQuoteRequest[r.id]} new message{unread.byQuoteRequest[r.id] === 1 ? '' : 's'}
                        </span>
                      )}
                    </Link>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div role="tabpanel" id="panel-visits" aria-labelledby="tab-visits" hidden={tab !== 'visits'}>
          <SiteVisitList viewerRole="CONTRACTOR" inTab />
        </div>

        <div role="tabpanel" id="panel-alerts" aria-labelledby="tab-alerts" hidden={tab !== 'alerts'}>
          <p className="text-stone text-xs mb-4">Projects our team has personally matched to your profile.</p>
          {me.projectAlerts.length === 0 ? (
            <p className="text-sm text-stone">No project alerts yet. We&apos;ll let you know when a project matches your trade.</p>
          ) : (
              <div className="flex flex-col gap-3">
                {me.projectAlerts.map((a) => (
                  <div key={a.id} className="border border-ink rounded-[6px] p-4">
                    <div className="flex justify-between items-start flex-wrap gap-2 mb-2">
                      <div>
                        <p className="font-medium text-sm">{a.projectPost.developer.name}</p>
                        <p className="text-stone text-xs mt-0.5">
                          {a.projectPost.projectType} · {a.projectPost.location} · {a.projectPost.budgetRangeLabel}
                        </p>
                      </div>
                      <span className="flex items-center gap-2 text-xs text-stone">
                        {a.isNew && <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-ink text-paper">New</span>}
                        {new Date(a.alertedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm mb-3">{a.projectPost.details}</p>
                    <div className="flex gap-4 text-xs text-stone border-t border-line pt-2.5">
                      <a href={`mailto:${a.projectPost.developer.email}`} className="hover:text-ink underline underline-offset-2">
                        {a.projectPost.developer.email}
                      </a>
                      <a href={`tel:${a.projectPost.contactPhone}`} className="hover:text-ink underline underline-offset-2">
                        {a.projectPost.contactPhone}
                      </a>
                    </div>
                    <div className="mt-3">
                      <AlertMessageButton
                        alertId={a.id}
                        developerName={a.projectPost.developer.name}
                        conversationId={a.conversationId}
                      />
                    </div>
                  </div>
                ))}
              </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
