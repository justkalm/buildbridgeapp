// src/app/browse/page.tsx

'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { TRADE_TYPE_CATEGORIES, HOMEPAGE_TRADE_CATEGORIES } from '@/lib/trade-types';
import VerifiedBadge from '@/components/VerifiedBadge';
import ShortlistButton from '@/components/ShortlistButton';
import BrowseFilterSheet from '@/components/BrowseFilterSheet';
import BrowseCardSkeleton from '@/components/BrowseCardSkeleton';
import BrowseLogo from '@/components/BrowseLogo';
import { formatLocation, normalizeLocation } from '@/lib/location';

type Contractor = {
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
  rating: number;
  reviewCount: number;
  // licenseNumber intentionally NOT included — browse cards no longer
  // show it (see ShortlistButton-adjacent #15 cleanup), and the list API
  // (api/contractors/route.ts) stopped selecting it, so there's nothing
  // to type here. It's still shown on the full profile page.
  _count: { projects: number };
};

type SortOption = 'experience' | 'projects' | 'location';

const MIN_EXPERIENCE_OPTIONS = [0, 5, 10, 20];
const MIN_PROJECTS_OPTIONS = [0, 1, 3, 5];

function BrowsePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [contractors, setContractors] = useState<Contractor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<string>(searchParams.get('trade') ?? 'all');
  // Separate from selectedTrade: a homepage category link (e.g. "RCC &
  // Structural") maps to SEVERAL real trade strings (see
  // HOMEPAGE_TRADE_CATEGORIES in trade-types.ts), not one exact value the
  // single-select trade dropdown can represent. Reading it as its own
  // param and matching with .some() against the mapped list, rather than
  // trying to force it through the same exact-match selectedTrade state,
  // is what actually makes the homepage's category links work — they used
  // to link to ?trade=<ad-hoc label that matched nothing in the real
  // taxonomy>, so every homepage category returned zero results
  // regardless of what was actually listed.
  const categoryParam = searchParams.get('category');
  const categoryTrades = categoryParam
    ? HOMEPAGE_TRADE_CATEGORIES.find((c) => c.label === categoryParam)?.trades ?? null
    : null;
  const [selectedCity, setSelectedCity] = useState<string>('all');
  // Area (neighbourhood, e.g. "Thane", "Andheri West") narrows within a
  // city rather than replacing it — see #12. Reset to 'all' whenever the
  // city changes (handled in the city <select>'s onChange below) since an
  // area chosen under one city is meaningless once a different city is
  // selected.
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [minExperience, setMinExperience] = useState(0);
  const [minProjects, setMinProjects] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('experience');

  const { status: sessionStatus, data: session } = useSession();
  const isDeveloper = sessionStatus === 'authenticated' && (session?.user as { role?: string })?.role === 'developer';
  const [shortlistedIds, setShortlistedIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch('/api/contractors')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load contractors');
        return res.json();
      })
      // Normalize city/area once on arrival so the filters, the cards and
      // the sort all see one spelling per place, even for rows saved
      // before capitalisation was enforced on save (see
      // src/lib/location.ts). "thane" and "Thane" become one option.
      .then((rows: Contractor[]) =>
        setContractors(
          rows.map((c) => ({ ...c, city: normalizeLocation(c.city), area: normalizeLocation(c.area) }))
        )
      )
      .catch(() => setError('Could not load contractors right now. Please try again shortly.'));
  }, []);

  // Load which contractors this developer already saved, so cards can
  // show the real "✓ Saved" state instead of always starting at "+ Save"
  // and only looking right after a click in this same session (the bug
  // this fetch fixes — see ShortlistButton's header comment). Only fired
  // for logged-in developers: a logged-out visitor or a contractor
  // account can't have a shortlist, so there's nothing to fetch.
  useEffect(() => {
    if (!isDeveloper) return;
    fetch('/api/developers/shortlist?ids=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { contractorIds: string[] } | null) => {
        if (data) setShortlistedIds(new Set(data.contractorIds));
      })
      .catch(() => {
        // Non-fatal — cards just fall back to showing "+ Save" until the
        // developer saves something in this session.
      });
  }, [isDeveloper]);

  const availableTrades = useMemo(() => {
    if (!contractors) return [];
    const allTrades = contractors.flatMap((c) => c.tradeTypes);
    return Array.from(new Set(allTrades)).sort();
  }, [contractors]);

  // Groups availableTrades by the same 8 categories used in
  // src/lib/trade-types.ts, so the filter dropdown organizes trades the
  // same way the contractor-side picker does. Previously this page just
  // listed every distinct trade string as a flat row of pill buttons —
  // fine when trades were a handful of loose free-text values, but once
  // the 90-item closed taxonomy landed, even one contractor selecting
  // several trades across categories produced a long, unsorted-feeling
  // wrapping row of buttons. Category groups fix that; only categories
  // with at least one trade actually in use are shown, so this never
  // shows empty groups even though the full taxonomy has 8 categories.
  const tradeOptgroups = useMemo(() => {
    const availableSet = new Set(availableTrades);
    return TRADE_TYPE_CATEGORIES.map((c) => ({
      label: c.category,
      options: c.trades.filter((t) => availableSet.has(t)).map((t) => ({ value: t, label: t })),
    })).filter((group) => group.options.length > 0);
  }, [availableTrades]);

  const availableCities = useMemo(() => {
    if (!contractors) return [];
    // .filter(Boolean): a contractor with no city yet (e.g. self-signup
    // before filling in their profile) would otherwise add a blank option.
    return Array.from(new Set(contractors.map((c) => c.city).filter(Boolean))).sort();
  }, [contractors]);

  // Areas are scoped to the selected city — picking "Mumbai" then only
  // offers Mumbai's areas, not every area across every city, since an
  // area name like "Andheri West" is only meaningful relative to its
  // city. With no city selected, all areas across all contractors are
  // offered (still useful — a developer may know the area they want but
  // not think of it in terms of city first).
  const availableAreas = useMemo(() => {
    if (!contractors) return [];
    const pool = selectedCity === 'all' ? contractors : contractors.filter((c) => c.city === selectedCity);
    return Array.from(new Set(pool.map((c) => c.area).filter(Boolean))).sort();
  }, [contractors, selectedCity]);

  const filteredContractors = useMemo(() => {
    if (!contractors) return null;

    let result = contractors;
    if (selectedTrade !== 'all') {
      result = result.filter((c) => c.tradeTypes.includes(selectedTrade));
    }
    if (categoryTrades) {
      result = result.filter((c) => c.tradeTypes.some((t) => categoryTrades.includes(t)));
    }
    if (selectedCity !== 'all') {
      result = result.filter((c) => c.city === selectedCity);
    }
    if (selectedArea !== 'all') {
      result = result.filter((c) => c.area === selectedArea);
    }
    if (minExperience > 0) {
      result = result.filter((c) => (c.yearsInBusiness ?? 0) >= minExperience);
    }
    if (minProjects > 0) {
      result = result.filter((c) => c._count.projects >= minProjects);
    }

    // Sort on a copy — the arrays above may already be `contractors` itself
    // when no filter was applied, and mutating that with .sort() would
    // silently reorder the original fetched list too.
    result = [...result];

    // Tier always wins first — paying contractors (PRO, then PLUS) show
    // above free (LISTED) ones regardless of which sort option is picked.
    // This used to be undone entirely: the backend fetch already ordered
    // by tier, but this client-side sort ran on top of it and only looked
    // at experience/projects/location, silently discarding that order. The
    // dropdown now only controls ranking WITHIN a tier, not whether tier
    // matters at all — "highest payer shows first" should hold no matter
    // which sort view someone's looking at.
    const TIER_RANK: Record<Contractor['tier'], number> = { PRO: 0, PLUS: 1, LISTED: 2 };

    result.sort((a, b) => {
      const tierDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
      if (tierDiff !== 0) return tierDiff;

      if (sortBy === 'experience') {
        return (b.yearsInBusiness ?? 0) - (a.yearsInBusiness ?? 0);
      }
      if (sortBy === 'projects') {
        return b._count.projects - a._count.projects;
      }
      return `${a.city}${a.area}`.localeCompare(`${b.city}${b.area}`);
    });

    return result;
    // categoryTrades is safe as a dependency: it's an array straight out of
    // the HOMEPAGE_TRADE_CATEGORIES constant, so it keeps the same identity
    // between renders until the ?category= param actually changes.
  }, [contractors, selectedTrade, categoryTrades, selectedCity, selectedArea, minExperience, minProjects, sortBy]);

  // One number for the phone "Filters" button badge. Sort isn't counted:
  // it reorders results rather than narrowing them, and it always has a
  // value, so counting it would make the badge never read zero.
  const activeFilterCount =
    (selectedTrade !== 'all' ? 1 : 0) +
    (categoryParam ? 1 : 0) +
    (selectedCity !== 'all' ? 1 : 0) +
    (selectedArea !== 'all' ? 1 : 0) +
    (minExperience > 0 ? 1 : 0) +
    (minProjects > 0 ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0;

  // Shared by the desktop bar's "Clear filters", the phone sheet's
  // "Clear all" and the no-matches empty state's button, so all three
  // clear exactly the same things.
  function clearFilters() {
    setSelectedTrade('all');
    setSelectedCity('all');
    setSelectedArea('all');
    setMinExperience(0);
    setMinProjects(0);
    // categoryParam (and the initial selectedTrade value) come from the
    // URL, not component state. Clearing just the state above left a
    // homepage category link's ?category=... still applied after clicking
    // "Clear filters", since the filter logic reads it straight from
    // searchParams on every render regardless of component state.
    // Actually navigating to the bare /browse URL is what clears it for
    // real.
    if (searchParams.toString()) {
      router.replace('/browse');
    }
  }

  // Phone filter sheet (KALM-059). closeSheet must be a stable function:
  // BrowseFilterSheet's open/close effect depends on it, and a new
  // function every render would re-run that effect (bouncing focus back
  // to the Filters button) on every filter change.
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);

  // The filter controls, rendered twice from the same state: inline in
  // the desktop bar, and stacked (label above a full-width select) inside
  // the phone sheet. Only one of the two is ever displayed at a time (the
  // bar is `hidden md:flex`, the sheet `md:hidden`), so there's one set of
  // controls on screen and one source of truth behind both.
  function renderFilters(stacked: boolean) {
    return (
      <>
        {/* Always rendered, even with only one trade (or one contractor)
            listed: a filter that vanishes the moment there's little to
            filter is more confusing than a single-option dropdown, and it
            flickers in/out as contractors are added/removed. See #11. */}
        <FilterSelect
          stacked={stacked}
          label="Trade"
          value={selectedTrade}
          onChange={setSelectedTrade}
          options={[{ value: 'all', label: 'All trades' }]}
          optgroups={tradeOptgroups}
        />
        <FilterSelect
          stacked={stacked}
          label="City"
          value={selectedCity}
          onChange={(v) => {
            setSelectedCity(v);
            // Area is scoped to city: switching city invalidates whatever
            // area was selected under the old one.
            setSelectedArea('all');
          }}
          options={[{ value: 'all', label: 'All cities' }, ...availableCities.map((c) => ({ value: c, label: c }))]}
        />
        <FilterSelect
          stacked={stacked}
          label="Area"
          value={selectedArea}
          onChange={setSelectedArea}
          options={[{ value: 'all', label: 'All areas' }, ...availableAreas.map((a) => ({ value: a, label: a }))]}
        />
        <FilterSelect
          stacked={stacked}
          label="Min. experience"
          value={String(minExperience)}
          onChange={(v) => setMinExperience(Number(v))}
          options={MIN_EXPERIENCE_OPTIONS.map((n) => ({
            value: String(n),
            label: n === 0 ? 'Any experience' : `${n}+ years`,
          }))}
        />
        <FilterSelect
          stacked={stacked}
          label="Min. projects"
          value={String(minProjects)}
          onChange={(v) => setMinProjects(Number(v))}
          options={MIN_PROJECTS_OPTIONS.map((n) => ({
            value: String(n),
            label: n === 0 ? 'Any' : `${n}+ projects listed`,
          }))}
        />
      </>
    );
  }

  function renderSort(stacked: boolean) {
    return (
      <FilterSelect
        stacked={stacked}
        label="Sort by"
        value={sortBy}
        onChange={(v) => setSortBy(v as SortOption)}
        options={[
          { value: 'experience', label: 'Most experience' },
          { value: 'projects', label: 'Most projects' },
          { value: 'location', label: 'Location (A to Z)' },
        ]}
      />
    );
  }

  const resultCount = filteredContractors?.length ?? 0;

  return (
    <>
      <Nav />

      <header className="bg-paper text-ink border-b border-line pt-11 pb-10">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8">
          <h1 className="font-display font-light text-[clamp(28px,3.6vw,38px)]">
            Find your contractor
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] mx-auto px-5 sm:px-8 py-10 w-full">
        {error && (
          <div role="alert" className="bg-danger-soft border border-danger text-danger text-sm rounded-md p-4 mb-6">
            {error}
          </div>
        )}

        {!error && contractors === null && <BrowseCardSkeleton />}

        {/* Empty state (a): nothing listed on the platform at all (KALM-063).
            Filters are hidden here, since there's nothing to narrow and
            "try different filters" would send people hunting for results
            that don't exist. */}
        {contractors !== null && contractors.length === 0 && (
          <div className="border border-line rounded-md p-10 text-center bg-paper">
            <p className="text-ink font-medium">No verified contractors yet. Check back soon.</p>
          </div>
        )}

        {contractors !== null && contractors.length > 0 && filteredContractors !== null && (
          <>
            {/* Phones: one button that opens the filter sheet, instead of
                the desktop bar wrapping into half a screen of selects. */}
            <div className="md:hidden flex items-center justify-between gap-3 mb-6 pb-6 border-b border-line">
              <button
                ref={filtersButtonRef}
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                className="inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-md border border-line bg-paper text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                Filters
                {activeFilterCount > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-ink text-paper text-[11px] font-medium inline-flex items-center justify-center">
                    {activeFilterCount}
                    <span className="sr-only"> active</span>
                  </span>
                )}
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[13px] text-stone hover:text-ink underline underline-offset-2"
                >
                  Clear filters
                </button>
              )}
            </div>

            <BrowseFilterSheet
              open={sheetOpen}
              onClose={closeSheet}
              triggerRef={filtersButtonRef}
              resultCount={resultCount}
              hasActiveFilters={hasActiveFilters}
              onClearAll={clearFilters}
            >
              {renderFilters(true)}
              {renderSort(true)}
            </BrowseFilterSheet>

            {/* Desktop: the inline filter + sort bar. */}
            <div className="hidden md:flex flex-wrap items-center gap-3 mb-6 pb-6 border-b border-line">
              {renderFilters(false)}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[13px] text-stone hover:text-ink underline underline-offset-2"
                >
                  Clear filters
                </button>
              )}

              <div className="ml-auto">{renderSort(false)}</div>
            </div>

            {/* aria-live so a screen reader hears the new count after each
                filter change, without having to go looking for it. */}
            <p className="text-sm text-stone mb-6" aria-live="polite">
              {resultCount === 0
                ? 'No matches'
                : `${resultCount} verified contractor${resultCount === 1 ? '' : 's'}`}
            </p>

            {/* Empty state (b): contractors exist, the filters just exclude
                all of them (KALM-063). The way out is one obvious button. */}
            {resultCount === 0 ? (
              <div className="border border-line rounded-md p-10 text-center bg-paper">
                <p className="text-ink font-medium mb-4">No contractors match these filters.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium px-5 py-2.5 rounded-md bg-ink text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredContractors.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contractors/${c.slug}`}
                    className="block bg-paper border border-line rounded-md p-6 shadow-[0_2px_12px_-4px_rgba(28,30,34,0.06)] hover:shadow-[0_8px_28px_-8px_rgba(28,30,34,0.14)] hover:-translate-y-0.5 hover:border-ink transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <BrowseLogo name={c.name} logoUrl={c.logoUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-display text-lg">{c.name}</span>
                            {c.verificationStatus === 'VERIFIED' && <VerifiedBadge reviewPending={c.reverifyPending} />}
                            {/* KALM-071: PLUS and PRO contractors are ranked
                                above free listings (see the tier sort
                                above), so say so on the card. One honest
                                label for both paid tiers rather than
                                "Plus"/"Pro" tier names, which read like a
                                quality grade rather than a paid placement.
                                The title is a hover tooltip; the sr-only
                                text gives screen readers the same
                                explanation, since title isn't reliably
                                announced. */}
                            {(c.tier === 'PLUS' || c.tier === 'PRO') && (
                              <span
                                title="Paid listing. Shown higher in results."
                                className="inline-flex items-center text-[11px] text-stone bg-paper-dim border border-line rounded-full px-2.5 py-1"
                              >
                                Promoted
                                <span className="sr-only">: paid listing, shown higher in results</span>
                              </span>
                            )}
                          </div>
                          <ShortlistButton
                            contractorId={c.id}
                            initiallySaved={shortlistedIds?.has(c.id) ?? false}
                          />
                        </div>
                        <p className="text-sm text-stone mb-3">
                          <span aria-hidden="true">📍 </span>
                          <span className="sr-only">Location: </span>
                          {formatLocation(c.area, c.city)}
                          {c.yearsInBusiness ? ` · ${c.yearsInBusiness}+ years` : ''}
                        </p>
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {c.tradeTypes.map((t) => (
                            <span key={t} className="text-[11px] font-medium px-2.5 py-1 bg-paper-dim rounded-full text-stone">
                              {t}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <span className="font-medium block">{c._count.projects}</span>
                            <span className="text-xs text-stone">Projects listed</span>
                          </div>
                          {c.reviewCount > 0 && (
                            // KALM-067: the visual "4.5 ★ / 12 reviews"
                            // pair is hidden from screen readers, which
                            // would read it as "4.5 black star 12
                            // reviews"; one plain sentence replaces it.
                            <div>
                              <span aria-hidden="true">
                                <span className="font-medium block">{c.rating.toFixed(1)} ★</span>
                                <span className="text-xs text-stone">
                                  {c.reviewCount} review{c.reviewCount === 1 ? '' : 's'}
                                </span>
                              </span>
                              <span className="sr-only">
                                Rated {c.rating.toFixed(1)} out of 5 from {c.reviewCount} review
                                {c.reviewCount === 1 ? '' : 's'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  optgroups,
  stacked = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  // Flat option list, used by every filter except trade (location, min
  // experience, min projects, sort).
  options?: { value: string; label: string }[];
  // Grouped option list, rendered as <optgroup> sections: added for the
  // trade filter specifically, since the 90-item closed trade taxonomy
  // (see src/lib/trade-types.ts) made a flat alphabetical list of
  // whatever trades happen to be in use unreadable once even one
  // contractor with many trades was added. The trade filter passes both:
  // `options` for the leading "All trades" entry, `optgroups` for the rest.
  optgroups?: { label: string; options: { value: string; label: string }[] }[];
  // Label above a full-width select, for the phone filter sheet, instead
  // of the desktop bar's label-beside-select row. The larger text there
  // also keeps iOS Safari from zooming the page when a select is tapped
  // (it zooms on form controls under 16px).
  stacked?: boolean;
}) {
  return (
    <label
      className={
        stacked
          ? 'flex flex-col gap-1.5 text-[13px] text-stone'
          : 'flex items-center gap-2 text-[13px] text-stone'
      }
    >
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${stacked ? 'w-full text-base py-2.5' : 'text-[13px] py-2'} px-3 rounded-md border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-ink cursor-pointer`}
      >
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {optgroups?.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

// The Suspense fallback (shown while useSearchParams resolves) is the
// same card skeleton the page shows while contractors load, rather than
// a blank screen, so the two loading phases look like one.
export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 max-w-[1440px] mx-auto px-5 sm:px-8 py-10 w-full">
          <BrowseCardSkeleton />
        </main>
      }
    >
      <BrowsePageInner />
    </Suspense>
  );
}
