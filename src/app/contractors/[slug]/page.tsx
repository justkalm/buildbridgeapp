// src/app/contractors/[slug]/page.tsx
//
// Public contractor profile: header, completed projects, business details
// and the "Request a Quotation" form in the sidebar.
//
// Accessibility / mobile notes (section E polish):
//   - Project cards open the lightbox from a real <button> on the card
//     title, stretched over the whole card with ::after (KALM-069). The
//     card can't itself be a <button> because ProjectGallery's photo
//     arrows are buttons, and buttons can't nest. The page keeps a ref to
//     each card button so closing the lightbox puts focus back on the card
//     that opened it.
//   - Below lg the sidebar (and so the quote form) ends up under every
//     project card, so a sticky ProfileQuoteBar at the bottom of the
//     screen jumps to it (KALM-060). See goToQuoteForm().
//   - "Message" buttons (header and sidebar) start or reopen a conversation:
//     developers get ProfileMessageButton, logged-out visitors a /login link,
//     contractors nothing. Hidden unless acceptsSiteVisits (the contractor has
//     an active account, which messaging needs too).
//   - Star ratings and decorative emoji are hidden from screen readers,
//     with words in their place where the meaning matters (KALM-066/067).

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import ProjectGallery from '@/components/ProjectGallery';
import SiteVisitRequest from '@/components/SiteVisitRequest';
import ProjectLightbox from '@/components/ProjectLightbox';
import VerifiedBadge from '@/components/VerifiedBadge';
import ShortlistButton from '@/components/ShortlistButton';
import ProfileMessageButton from '@/components/ProfileMessageButton';
import ProfileMessageLoginLink from '@/components/ProfileMessageLoginLink';
import ProfileImage from '@/components/ProfileImage';
import ProfileStars from '@/components/ProfileStars';
import ProfileReview from '@/components/ProfileReview';
import { SHOW_RATINGS } from '@/lib/ratings';
import ProfileSkeleton from '@/components/ProfileSkeleton';
import {
  EMPTY_QUOTE_DETAILS,
  QuoteDetailsFields,
  SavedProjectPicker,
  detailsFromProject,
  quoteDetailsBody,
  useQuoteFormData,
  type QuoteDetails,
} from '@/components/QuoteFormParts';
import ProfileQuoteBar, { ProfileQuoteBarSpacer } from '@/components/ProfileQuoteBar';
import { isPlaceholderLicense } from '@/lib/license';
import { formatLocation } from '@/lib/location';
import { groupByTrade, tradesOf } from '@/lib/trade-types';

// The quote form's "Project type" choices: the contractor's trades, or
// their raw values for a profile still on the old list.
function quoteOptionsFor(tradeTypes: string[]): string[] {
  const trades = tradesOf(tradeTypes);
  return trades.length > 0 ? trades : tradeTypes;
}

type Project = {
  id: string;
  title: string;
  developerName: string | null;
  projectType: string | null;
  squareFeet: number | null;
  elevationFloors: number | null;
  committedDurationMonths: number | null;
  actualDurationMonths: number | null;
  imageUrls: string[];
  reviewRating: number | null;
  reviewText: string | null;
};

// Offset for the sticky quote box, and the scroll margin used when the
// mobile quote bar scrolls to it: the Nav's height (--nav-h in
// globals.css, which Nav itself uses) plus a 16px gap. It used to be a
// hard-coded `top-24` (96px) that assumed a taller nav. Tailwind only sees
// complete class strings, so these stay literal.
const BELOW_NAV_STICKY = 'lg:sticky lg:top-[calc(var(--nav-h)+1rem)]';
const BELOW_NAV_SCROLL_MARGIN = 'scroll-mt-[calc(var(--nav-h)+1rem)]';

// Target of the mobile "Request a quote" bar.
const QUOTE_SECTION_ID = 'request-quote';

type ContractorDetail = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string;
  area: string;
  tradeTypes: string[];
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  reverifyPending: boolean;
  tier: 'LISTED' | 'PLUS' | 'PRO';
  yearsInBusiness: number | null;
  teamSizeMin: number | null;
  teamSizeMax: number | null;
  gstRegistered: boolean;
  insuranceCoverLakh: number | null;
  rating: number;
  reviewCount: number;
  licenseNumber: string;
  bio: string | null;
  projects: Project[];
  // False for an admin-entered listing nobody has claimed yet: there's no
  // one to answer a site visit request, so the panel isn't offered.
  acceptsSiteVisits: boolean;
};

export default function ContractorProfilePage() {
  const params = useParams<{ slug: string }>();
  const { status, data: session } = useSession();

  const [contractor, setContractor] = useState<ContractorDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [shortlistedIds, setShortlistedIds] = useState<Set<string> | null>(null);
  // Card "Open project" buttons by project id, so focus can go back to the
  // right card when the lightbox closes (KALM-069).
  const cardButtons = useRef(new Map<string, HTMLButtonElement>());

  const [projectType, setProjectType] = useState('');
  // Location, optional budget, details, phone and "save as a project";
  // see src/components/QuoteFormParts.
  const [quoteDetails, setQuoteDetails] = useState<QuoteDetails>(EMPTY_QUOTE_DETAILS);
  const [projectSavedNote, setProjectSavedNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(null);
  // Holds the API's own error message (and, for a known error code, that
  // code) so the form can show the real reason a quote request failed
  // instead of a generic message — see #2. Null on success or before any
  // submit.
  const [submitError, setSubmitError] = useState<{ message: string; code?: string } | null>(null);

  const role = (session?.user as { role?: string } | undefined)?.role;
  const isDeveloper = status === 'authenticated' && role === 'developer';
  const isContractorViewer = status === 'authenticated' && role === 'contractor';

  // Saved projects for the picker, and the account phone pre-filled (only
  // if the developer hasn't already typed one).
  const { projects: savedProjects } = useQuoteFormData(isDeveloper, (phone) =>
    setQuoteDetails((d) => (d.contactPhone ? d : { ...d, contactPhone: phone }))
  );

  useEffect(() => {
    if (!params.slug) return;
    fetch(`/api/contractors/${params.slug}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        if (data) {
          setContractor(data);
          setProjectType(quoteOptionsFor(data.tradeTypes)[0] ?? '');
        }
      })
      .catch(() => setNotFound(true));
  }, [params.slug]);

  // Real saved state for the shortlist button — mirrors the fetch added
  // to /browse (see ShortlistButton's header comment for why this can't
  // just be a prop the button fetches itself). Only fired for logged-in
  // developers.
  useEffect(() => {
    if (!isDeveloper) return;
    fetch('/api/developers/shortlist?ids=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { contractorIds: string[] } | null) => {
        if (data) setShortlistedIds(new Set(data.contractorIds));
      })
      .catch(() => {
        // Non-fatal — button falls back to showing "+ Save".
      });
  }, [isDeveloper]);

  function closeLightbox() {
    const id = openProject?.id;
    setOpenProject(null);
    // After the lightbox has unmounted (and restored body scrolling), put
    // focus back on the card that opened it.
    if (id) requestAnimationFrame(() => cardButtons.current.get(id)?.focus());
  }

  // Mobile quote bar: scroll the quote box into view and move focus into
  // it, onto whatever the box is currently showing: the first form field
  // for a developer, or the sign-up link for a logged-out visitor (the same
  // prompt the box itself shows). Elements marked data-quote-focus are the
  // targets; the box itself (tabIndex -1) is the fallback. Scrolling is
  // smooth unless the visitor prefers reduced motion (globals.css sets
  // scroll-behavior on <html>).
  function goToQuoteForm() {
    const box = document.getElementById(QUOTE_SECTION_ID);
    if (!box) return;
    box.scrollIntoView({ block: 'start' });
    const target = box.querySelector<HTMLElement>('[data-quote-focus]') ?? box;
    target.focus({ preventScroll: true });
  }

  async function handleQuoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractor) return;
    setSubmitting(true);
    setSubmitResult(null);
    setSubmitError(null);

    try {
      const res = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorId: contractor.id,
          projectType,
          ...quoteDetailsBody(quoteDetails),
        }),
      });

      if (res.ok) {
        const data: { projectSaved?: boolean } = await res.json().catch(() => ({}));
        setProjectSavedNote(
          data.projectSaved === true
            ? `Saved as "${quoteDetails.projectName.trim()}". Pick it from "Use a saved project" next time.`
            : data.projectSaved === false
              ? 'Your request was sent, but the project could not be saved. You can add it from your dashboard.'
              : null
        );
        setSubmitResult('success');
        // Keep the phone for the next request; clear the rest.
        setQuoteDetails((d) => ({ ...EMPTY_QUOTE_DETAILS, contactPhone: d.contactPhone }));
      } else {
        setSubmitResult('error');
        // Show the API's own explanation (e.g. "You've already sent a
        // request to this contractor", or the email-verification message
        // below) rather than a blanket "Something went wrong" — only
        // fall back to a generic message when the response isn't the
        // JSON `{ error }` shape we expect.
        let parsed: { error?: string; code?: string } | null = null;
        try {
          parsed = await res.json();
        } catch {
          parsed = null;
        }
        setSubmitError({
          message: parsed?.error ?? 'Something went wrong. Please try again.',
          code: parsed?.code,
        });
      }
    } catch {
      setSubmitResult('error');
      setSubmitError({ message: 'Could not reach the server. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <>
        <Nav />
        <main className="flex-1 flex items-center justify-center py-24">
          <p className="text-stone">Contractor not found.</p>
        </main>
        <Footer />
      </>
    );
  }

  if (!contractor) {
    return (
      <>
        <Nav />
        <ProfileSkeleton />
        <Footer />
      </>
    );
  }

  // Not for contractor viewers (they can't send one), not while the
  // session is still resolving (avoids a flash for contractors), and not
  // once a request has gone through.
  const showQuoteBar = status !== 'loading' && !isContractorViewer && submitResult !== 'success';

  // Messaging: developers message, visitors are sent to log in, contractors
  // see nothing. Not while the session is resolving (avoids a flash).
  const showMessage = contractor.acceptsSiteVisits && status !== 'loading' && !isContractorViewer;

  return (
    <>
      <Nav />

      <header className="bg-paper text-ink border-b border-line pt-11 pb-9">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8">
          <div className="flex items-start gap-5 flex-wrap justify-between">
            <div className="flex gap-5">
              <div className="relative w-[84px] h-[84px] rounded-xl bg-paper-dim border border-line text-ink font-display text-3xl flex items-center justify-center shrink-0 overflow-hidden">
                {contractor.logoUrl ? (
                  <ProfileImage
                    src={contractor.logoUrl}
                    alt={`${contractor.name} logo`}
                    fill
                    sizes="84px"
                    className="object-cover"
                  />
                ) : (
                  contractor.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap mb-2">
                  <h1 className="font-display font-light text-[28px]">{contractor.name}</h1>
                  {contractor.verificationStatus === 'VERIFIED' && <VerifiedBadge reviewPending={contractor.reverifyPending} />}
                </div>
                <div className="flex gap-4 flex-wrap text-[13.5px] text-stone mb-3">
                  <span>
                    <span aria-hidden="true">📍 </span>
                    <span className="sr-only">Location: </span>
                    {formatLocation(contractor.area, contractor.city)}
                  </span>
                  <span>
                    <span aria-hidden="true">🏗️ </span>
                    <span className="sr-only">Trades: </span>
                    {tradesOf(contractor.tradeTypes).join(', ')}
                  </span>
                  {contractor.yearsInBusiness ? (
                    <span>
                      <span aria-hidden="true">📅 </span>
                      {contractor.yearsInBusiness}+ years in business
                    </span>
                  ) : null}
                </div>
                {SHOW_RATINGS && contractor.reviewCount > 0 && (
                  <div className="flex items-center gap-2.5">
                    <ProfileStars rating={contractor.rating} className="text-ink text-base tracking-wide" />
                    {/* Visible number repeats the screen-reader sentence above. */}
                    <span aria-hidden="true" className="font-medium text-[15px]">
                      {contractor.rating.toFixed(1)}
                    </span>
                    <span className="text-stone text-[13.5px]">({contractor.reviewCount} reviews)</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 flex-wrap shrink-0">
              {showMessage &&
                (isDeveloper ? (
                  <ProfileMessageButton contractorId={contractor.id} contractorName={contractor.name} />
                ) : (
                  <ProfileMessageLoginLink />
                ))}
              <ShortlistButton
                contractorId={contractor.id}
                initiallySaved={shortlistedIds?.has(contractor.id) ?? false}
                className="text-sm px-4 py-2.5 rounded-full border border-line text-ink hover:border-ink transition-colors shrink-0"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-11 py-12">
        <div>
          {contractor.bio && <p className="text-[15px] text-stone leading-relaxed mb-8">{contractor.bio}</p>}

          {/* Specialities under each trade (KALM-167). */}
          {contractor.tradeTypes.length > 0 && (
            <section aria-labelledby="specialities-heading" className="mb-10">
              <h2 id="specialities-heading" className="font-display text-xl mb-4">What they do</h2>
              <div className="flex flex-col gap-4">
                {groupByTrade(contractor.tradeTypes).map((g) => (
                  <div key={g.trade}>
                    <h3 className="text-[13px] font-medium text-ink mb-2">{g.trade}</h3>
                    <ul className="flex gap-1.5 flex-wrap">
                      {g.specialities.map((sp) => (
                        <li key={sp} className="text-[12px] px-2.5 py-1 bg-paper-dim rounded-full text-stone">
                          {sp}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          <h2 className="font-display text-xl mb-5">Completed Projects</h2>
          {contractor.acceptsSiteVisits && contractor.projects.length > 0 && !isContractorViewer && status !== 'loading' && (
            <SiteVisitRequest
              contractorId={contractor.id}
              contractorName={contractor.name}
              projects={contractor.projects.map((p) => ({ id: p.id, title: p.title }))}
              isDeveloper={isDeveloper}
            />
          )}
          {contractor.projects.length === 0 ? (
            <p className="text-sm text-stone border border-line rounded-md p-6 bg-paper">
              No projects listed yet for this contractor.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {contractor.projects.map((p) => (
                <div
                  key={p.id}
                  className="relative border border-line rounded-md overflow-hidden bg-paper hover:border-ink transition-colors"
                >
                  <ProjectGallery imageUrls={p.imageUrls} projectTitle={p.title} />
                  <div className="p-4">
                    <h3 className="font-display text-[15px] mb-1">
                      {/* Stretched button: its ::after covers the whole
                          card, so a click anywhere opens the project, and
                          the focus ring is drawn around the card. */}
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) cardButtons.current.set(p.id, el);
                          else cardButtons.current.delete(p.id);
                        }}
                        onClick={() => setOpenProject(p)}
                        aria-label={`Open project: ${p.title}`}
                        className="text-left cursor-pointer focus-visible:outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ink"
                      >
                        {p.title}
                      </button>
                    </h3>
                    {(p.developerName || p.projectType || p.elevationFloors) && (
                      <p className="text-xs text-stone mb-3">
                        {[
                          p.developerName && `Developer: ${p.developerName}`,
                          p.projectType,
                          p.elevationFloors && `G+${p.elevationFloors}`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {SHOW_RATINGS && p.reviewRating ? (
                      <div className="border-t border-line pt-3 mt-1">
                        <ProfileReview rating={p.reviewRating} text={p.reviewText} developerName={p.developerName} />
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center pt-3 border-t border-line">
                      {p.squareFeet && (
                        <span className="font-medium text-sm text-ink">
                          {p.squareFeet.toLocaleString('en-IN')} sq ft
                        </span>
                      )}
                    </div>
                    {(p.committedDurationMonths || p.actualDurationMonths) && (
                      <p className="text-xs text-stone mt-2">
                        {p.committedDurationMonths && `Committed: ${p.committedDurationMonths} mo`}
                        {p.committedDurationMonths && p.actualDurationMonths && ' · '}
                        {p.actualDurationMonths && `Actual: ${p.actualDurationMonths} mo`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="bg-paper border border-line rounded-md p-6 mb-5">
            <h4 className="font-display text-[15.5px] mb-4">Business Details</h4>
            <dl className="text-[13.5px]">
              <div className="flex justify-between py-2.5 border-b border-line">
                <dt className="text-stone">License Number</dt>
                {/* Self-signed-up contractors get a placeholder
                    'PENDING-<hex>' licenseNumber until admin records the
                    real one (see the admin contractors route). Showing
                    that raw placeholder to developers reads as a real
                    license number, so it's hidden here — never rendered,
                    not even truncated. Admin-side blocking of the
                    placeholder is handled separately. */}
                {isPlaceholderLicense(contractor.licenseNumber) ? (
                  <dd className="text-xs text-stone italic">License details pending</dd>
                ) : (
                  <dd className="text-xs font-medium">{contractor.licenseNumber}</dd>
                )}
              </div>
              {(contractor.teamSizeMin || contractor.teamSizeMax) && (
                <div className="flex justify-between py-2.5 border-b border-line">
                  <dt className="text-stone">Team Size</dt>
                  <dd className="font-medium">{contractor.teamSizeMin}–{contractor.teamSizeMax} workers</dd>
                </div>
              )}
              <div className="flex justify-between py-2.5 border-b border-line">
                <dt className="text-stone">GST Registered</dt>
                <dd className="font-medium">{contractor.gstRegistered ? 'Yes' : 'Not disclosed'}</dd>
              </div>
              {contractor.insuranceCoverLakh && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-stone">Insurance Cover</dt>
                  <dd className="font-medium">₹{contractor.insuranceCoverLakh} L</dd>
                </div>
              )}
            </dl>
          </div>

          {/* KALM-180: one line explaining the contact options. The site
              visit part only shows when that option is really available. */}
          {showMessage && (
            <p className="text-xs text-stone mb-2">
              Message to ask a question · Request a quote for pricing
              {contractor.acceptsSiteVisits && contractor.projects.length > 0 && ' · Site visit to see their work'}
            </p>
          )}

          {showMessage && (
            <div className="bg-paper border border-line rounded-md p-4 mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13.5px] text-stone">Have a question first? Message {contractor.name}</p>
              {isDeveloper ? (
                <ProfileMessageButton
                  contractorId={contractor.id}
                  contractorName={contractor.name}
                  className="text-sm px-4 py-2 rounded-full border border-line text-ink hover:border-ink transition-colors disabled:opacity-60"
                />
              ) : (
                <ProfileMessageLoginLink className="text-sm px-4 py-2 rounded-full border border-line text-ink hover:border-ink transition-colors" />
              )}
            </div>
          )}

          <div
            id={QUOTE_SECTION_ID}
            tabIndex={-1}
            aria-labelledby="request-quote-heading"
            className={`bg-paper border border-line rounded-md p-6 focus:outline-none ${BELOW_NAV_STICKY} ${BELOW_NAV_SCROLL_MARGIN}`}
          >
            <h4 id="request-quote-heading" className="font-display text-[15.5px] mb-4">
              Request a Quotation
            </h4>

            {status === 'loading' ? null : status !== 'authenticated' ? (
              <div>
                <p className="text-sm text-stone mb-4">Sign in to request a quote from this contractor.</p>
                <Link
                  href="/signup"
                  data-quote-focus
                  className="block text-center bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors"
                >
                  Sign up to continue
                </Link>
                <p className="text-xs text-stone text-center mt-3">
                  Already have an account?{' '}
                  <Link href="/login" className="underline underline-offset-2 hover:text-ink">
                    Sign in
                  </Link>
                </p>
              </div>
            ) : isContractorViewer ? (
              // Quote requests are a developer-to-contractor flow — a
              // contractor account (their own, or browsing a peer's
              // profile) can't be the one sending one, and the POST
              // /api/quote-requests route only accepts a developer
              // session anyway. Showing the form and letting it fail on
              // submit would be a confusing dead end, so it's swapped for
              // an explanatory note instead. See #1.
              <p className="text-sm text-stone">
                You&apos;re signed in as a contractor. Quote requests are sent by developer accounts.
              </p>
            ) : submitResult === 'success' ? (
              <div className="text-sm">
                <p className="text-sage font-medium mb-1">Request sent.</p>
                <p className="text-stone">
                  {contractor.name} will be notified and can reach out to discuss your project.
                </p>
                {/* KALM-210: say what happens next. No promised reply time:
                    we have no real response data yet. */}
                <ul className="text-stone mt-3 list-disc pl-5 space-y-1">
                  <li>You will get an email each time {contractor.name} updates your request.</li>
                  <li>
                    You can write to them any time in{' '}
                    <Link href="/messages" className="underline underline-offset-2 hover:text-ink">
                      Messages
                    </Link>
                    .
                  </li>
                  <li>
                    Nothing yet after a few days? You can request a quote from another contractor on{' '}
                    <Link href="/browse" className="underline underline-offset-2 hover:text-ink">
                      Browse
                    </Link>
                    .
                  </li>
                </ul>
                {projectSavedNote && <p className="text-stone mt-2">{projectSavedNote}</p>}
              </div>
            ) : (
              <form onSubmit={handleQuoteSubmit} className="flex flex-col gap-3.5">
                <SavedProjectPicker
                  projects={savedProjects}
                  onPick={(p) => {
                    setQuoteDetails((d) => detailsFromProject(d, p));
                    // Use the project's work needed if this contractor does it.
                    if (p.workNeeded && quoteOptionsFor(contractor.tradeTypes).includes(p.workNeeded)) {
                      setProjectType(p.workNeeded);
                    }
                  }}
                />
                <div>
                  <label htmlFor="quote-project-type" className="block text-xs font-medium text-stone mb-1.5">
                    {/* KALM-179: label reads "Work needed"; the field, state and API
                        name stay projectType. */}
                    Work needed
                  </label>
                  <select
                    id="quote-project-type"
                    data-quote-focus
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-3 py-2.5 border border-line rounded-[4px] text-[13.5px] bg-paper"
                  >
                    {quoteOptionsFor(contractor.tradeTypes).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <QuoteDetailsFields value={quoteDetails} onChange={setQuoteDetails} />

                {submitResult === 'error' && submitError && (
                  <div role="alert" className="text-sm text-danger">
                    <p>{submitError.message}</p>
                    {/* POST /api/quote-requests returns 403 with code
                        EMAIL_NOT_VERIFIED for a developer whose email isn't
                        verified yet — point them at the dashboard, where
                        they can resend the verification email, rather than
                        leaving them stuck here. */}
                    {submitError.code === 'EMAIL_NOT_VERIFIED' && (
                      <Link href="/dashboard" className="underline underline-offset-2 font-medium">
                        Go to your dashboard to resend verification
                      </Link>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 bg-ink text-paper font-medium text-sm py-3 rounded-full hover:bg-stone transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Sending…' : 'Send Request'}
                </button>
                <p className="text-[11.5px] text-stone leading-relaxed">
                  {contractor.name} will be notified and can reach out directly to discuss.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <Footer />

      {showQuoteBar && (
        <>
          <ProfileQuoteBarSpacer />
          <ProfileQuoteBar onClick={goToQuoteForm} />
        </>
      )}

      {openProject && <ProjectLightbox project={openProject} onClose={closeLightbox} />}
    </>
  );
}
