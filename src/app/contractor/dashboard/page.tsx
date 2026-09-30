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
import InstallAppPrompt from '@/components/InstallAppPrompt';
import PushPrompt from '@/components/PushPrompt';
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
  LISTED: 'Listed (free)',
  PLUS: 'Plus',
  PRO: 'Pro',
};

export default function ContractorDashboardPage() {
  const { status: sessionStatus, data: session } = useSession();
  const router = useRouter();
  const [me, setMe] = useState<ContractorMe | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<{ id: string; message: string } | null>(null);
  const isContractor =
    sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role === 'contractor';
  const unread = useUnreadMessages(isContractor, 30_000);

  async function changeStatus(r: QuoteRequestRow, next: Exclude<QuoteStatus, 'PENDING'>) {
    if (
      next === 'DECLINED' &&
      !window.confirm(`Decline ${r.developer.name}'s request? They'll be emailed, and this can't be undone.`)
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

  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[1440px] mx-auto px-5 sm:px-8 py-10 w-full">
        <div className="flex justify-between items-start flex-wrap gap-4 mb-9">
          <div>
            <h1 className="font-display font-light text-[28px] mb-1">Welcome back, {me.name}</h1>
            <p className="text-stone text-[14.5px]">Your (kalm) contractor dashboard.</p>
          </div>
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
            <Link
              href="/contractor/consent"
              className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full border border-line hover:bg-paper-dim transition-colors"
            >
              Data sharing
            </Link>
          </nav>
        </div>

        {!me.emailVerified && (
          <div className="mb-6 px-4 py-3 rounded-[6px] bg-paper-dim text-stone text-sm">
            Your email isn&apos;t verified yet. Check your inbox for a verification link.
          </div>
        )}

        {/* Order set by the owner (KALM-173): new enquiries first, then
            site visits, then project alerts, and listing status / tier
            last. The notification prompts sit just below the enquiries
            so they don't push them down. */}
        <div className="mb-10">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="font-display font-light text-xl">Quote requests received</h2>
            <p className="text-xs text-stone mt-1">
              Replies and developers&apos; questions are in{' '}
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

        <InstallAppPrompt />
        <PushPrompt />

        <SiteVisitList viewerRole="CONTRACTOR" />

        {me.projectAlerts.length > 0 && (
          <>
            <h2 className="font-display font-light text-xl mb-1">Project alerts</h2>
            <p className="text-stone text-xs mb-4">
              Projects our team has personally matched to your profile.
            </p>
            <div className="flex flex-col gap-3 mb-10">
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
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 mb-4">
          <div className="border border-line rounded-[6px] p-5">
            <p className="text-xs text-stone mb-2">Listing status</p>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${verification.style}`}>
              {verification.label}
            </span>
            {me.verificationStatus !== 'PENDING' && (
              <p className="text-xs text-stone mt-2">
                Your listing always stays live when you edit. Changing your location, phone, GST
                status or trades adds &quot;update in review&quot; to your badge until we check it.
                Editing your bio, team details or projects doesn&apos;t.
              </p>
            )}
          </div>
          <div className="border border-line rounded-[6px] p-5">
            <p className="text-xs text-stone mb-2">Current tier</p>
            <p className="text-lg font-medium">{tierLabel[me.tier]}</p>
            <p className="text-xs text-stone mt-2">
              Free during the current trial period. Paid tiers coming later.
            </p>
          </div>
        </div>

      </main>
      <Footer />
    </>
  );
}
