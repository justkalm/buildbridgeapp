// src/app/browse/page.tsx

'use client';

import { SHOW_RATINGS } from '@/lib/ratings';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { ALL_TRADES, specialityLabel, tradesOf } from '@/lib/trade-types';
import DemoBadge from '@/components/DemoBadge';
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
  isDemo: boolean;
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

// What /api/contractors sends back: one batch of cards plus the counts and
// (with the first batch only) the dropdown options.
type Facets = {
  cities: string[];
  areas: { name: string; count: number }[];
  tradeCounts: Record<string, number>;
};
type BrowseResponse = {
  items: Contractor[];
  total: number;
  realCount: number;
  nextOffset: number | null;
  facets?: Facets;
};

const MIN_EXPERIENCE_OPTIONS = [0, 5, 10, 20];

// Specialities shown on a Browse card before "+N more".
const CARD_SPECIALITY_LIMIT = 6;

// Homepage category links made before the KALM-167 trade list used these
// labels; map them to the nearest new trade so old links still filter.
const LEGACY_CATEGORY_TO_TRADE: Record<string, string> = {
  'RCC & Structural': 'Civil & RCC',
  Electrical: 'Electrical',
  Waterproofing: 'Waterproofing & Roofing',
  'Interior Fit-out': 'Ceilings, Partitions & Interiors',
  Plumbing: 'Plumbing & Sanitation',
  'Facade & Cladding': 'Facade & Glazing',
};

function initialTrade(params: { get(name: string): string | null }): string {
  const trade = params.get('trade');
  if (trade && ALL_TRADES.includes(trade)) return trade;
  const legacy = LEGACY_CATEGORY_TO_TRADE[params.get('category') ?? ''];
  return legacy ?? 'all';
}
const MIN_PROJECTS_OPTIONS = [0, 1, 3, 5];

function BrowsePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Cards loaded so far (20 at a time; "Load more" appends the next 20).
  const [contractors, setContractors] = useState<Contractor[] | null>(null);
  const [total, setTotal] = useState(0); // contractors matching the filters, demos included
  const [realCount, setRealCount] = useState(0); // the same, demos left out
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  // Which filter set the cards on screen belong to; while it differs from the
  // current filters, a new batch is on its way.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Only the newest request may update the page, so a slow answer to an old
  // filter can't overwrite the results of a newer one.
  const requestId = useRef(0);
  const [error, setError] = useState<string | null>(null);
  // The trade filter (KALM-167): one of the 20 trades in
  // src/lib/trade-types.ts. A contractor matches when any of their
  // specialities belongs to it. Homepage shortcuts link with ?trade=;
  // ?category= is still read for links made before the new list, mapped
  // to the nearest new trade.
  const [selectedTrade, setSelectedTrade] = useState<string>(() => initialTrade(searchParams));
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

  function queryFor(offset: number): string {
    const q = new URLSearchParams();
    if (selectedTrade !== 'all') q.set('trade', selectedTrade);
    if (selectedCity !== 'all') q.set('city', selectedCity);
    if (selectedArea !== 'all') q.set('area', selectedArea);
    if (minExperience > 0) q.set('minExperience', String(minExperience));
    if (minProjects > 0) q.set('minProjects', String(minProjects));
    q.set('sort', sortBy);
    if (offset > 0) q.set('offset', String(offset));
    return q.toString();
  }

  // Normalize city/area on arrival so the cards show one spelling per
  // place, even for rows saved before capitalisation was enforced on save
  // (see src/lib/location.ts).
  function tidy(rows: Contractor[]): Contractor[] {
    return rows.map((c) => ({ ...c, city: normalizeLocation(c.city), area: normalizeLocation(c.area) }));
  }

  // First batch: runs on arrival and again whenever a filter or the sort changes.
  useEffect(() => {
    const id = ++requestId.current;
    const key = queryFor(0);
    fetch(`/api/contractors?${key}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load contractors');
        return res.json() as Promise<BrowseResponse>;
      })
      .then((data) => {
        if (id !== requestId.current) return;
        setContractors(tidy(data.items));
        setTotal(data.total);
        setRealCount(data.realCount);
        setNextOffset(data.nextOffset);
        if (data.facets) setFacets(data.facets);
        setLoadedKey(key);
        setError(null);
      })
      .catch(() => {
        if (id === requestId.current) {
          setLoadedKey(key);
          setError('Could not load contractors right now. Please try again shortly.');
        }
      });
    // queryFor reads exactly these values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTrade, selectedCity, selectedArea, minExperience, minProjects, sortBy]);

  // "Load more": the next 20, added under the ones already shown.
  function loadMore() {
    if (nextOffset === null || loadingMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    fetch(`/api/contractors?${queryFor(nextOffset)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load contractors');
        return res.json() as Promise<BrowseResponse>;
      })
      .then((data) => {
        if (id !== requestId.current) return; // filters changed meanwhile
        setContractors((prev) => {
          const seen = new Set((prev ?? []).map((c) => c.id));
          return [...(prev ?? []), ...tidy(data.items).filter((c) => !seen.has(c.id))];
        });
        setTotal(data.total);
        setRealCount(data.realCount);
        setNextOffset(data.nextOffset);
      })
      .catch(() => setError('Could not load more contractors. Please try again.'))
      .finally(() => setLoadingMore(false));
  }

  const loading = loadedKey !== queryFor(0);

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

  // Only trades and areas with at least one listed contractor are offered,
  // each with its count, so nobody picks a filter that leads to nothing
  // (owner's call, 10 Oct 2026; it used to list all 20 trades and every area
  // even when empty). A new trade or area appears the day a contractor in it
  // goes live. Whatever is currently selected stays in the list even at zero,
  // so a shared link or a narrowed search never shows a blank dropdown.
  // The counts and the city/area lists come from the server (facets), since
  // this page no longer holds the full list.
  const tradeOptions = ALL_TRADES.filter(
    (trade) => (facets?.tradeCounts[trade] ?? 0) > 0 || trade === selectedTrade
  ).map((trade) => ({
    value: trade,
    label: `${trade} (${facets?.tradeCounts[trade] ?? 0})`,
  }));

  const availableCities = facets?.cities ?? [];

  // Areas work the same way ("Bandra (7)"). Mumbai is the only city for now,
  // so the list isn't narrowed by city.
  const availableAreas = (facets?.areas ?? [])
    .filter((a) => a.count > 0 || a.name === selectedArea)
    .map((a) => ({ value: a.name, label: `${a.name} (${a.count})` }));

  // One number for the phone "Filters" button badge. Sort isn't counted:
  // it reorders results rather than narrowing them, and it always has a
  // value, so counting it would make the badge never read zero.
  const activeFilterCount =
    (selectedTrade !== 'all' ? 1 : 0) +
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
    // ?trade= / ?category= (and so the initial selectedTrade value) come from the
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
          options={[{ value: 'all', label: 'All trades' }, ...tradeOptions]}
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
          options={[{ value: 'all', label: 'All areas' }, ...availableAreas]}
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

  // Matches for the phone sheet's button; the cards below are 20 at a time.
  const resultCount = total;

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
        {contractors !== null && total === 0 && !hasActiveFilters && (
          <div className="border border-line rounded-md p-10 text-center bg-paper">
            <p className="text-ink font-medium">No verified contractors yet. Check back soon.</p>
          </div>
        )}

        {contractors !== null && !(total === 0 && !hasActiveFilters) && (
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
              {total === 0
                ? 'No matches'
                : realCount === 0
                  ? 'No verified contractors here yet. Showing sample profiles.'
                  : `${realCount} verified contractor${realCount === 1 ? '' : 's'}`}
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
              <div className={`flex flex-col gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
                {contractors.map((c) => (
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
                            {c.isDemo ? <DemoBadge /> : c.verificationStatus === 'VERIFIED' && <VerifiedBadge reviewPending={c.reverifyPending} />}
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
                          <span className="sr-only">Location: </span>
                          {formatLocation(c.area, c.city)}
                          {c.yearsInBusiness ? ` · ${c.yearsInBusiness}+ years` : ''}
                        </p>
                        {/* Trades, then the first few specialities (KALM-167);
                            the full list is on the profile. */}
                        <p className="text-[13px] text-ink mb-1.5">
                          <span className="sr-only">Trades: </span>
                          {tradesOf(c.tradeTypes).join(' · ')}
                        </p>
                        <div className="flex gap-1.5 flex-wrap mb-3">
                          {c.tradeTypes.slice(0, CARD_SPECIALITY_LIMIT).map((t) => (
                            <span key={t} className="text-[11px] font-medium px-2.5 py-1 bg-paper-dim rounded-full text-stone">
                              {specialityLabel(t)}
                            </span>
                          ))}
                          {c.tradeTypes.length > CARD_SPECIALITY_LIMIT && (
                            <span className="text-[11px] px-2.5 py-1 text-stone">
                              +{c.tradeTypes.length - CARD_SPECIALITY_LIMIT} more
                            </span>
                          )}
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div>
                            <span className="font-medium block">{c._count.projects}</span>
                            <span className="text-xs text-stone">Projects listed</span>
                          </div>
                          {SHOW_RATINGS && c.reviewCount > 0 && (
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
                {nextOffset !== null && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="self-center mt-2 text-sm font-medium px-6 py-3 rounded-md border border-ink text-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                )}
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
