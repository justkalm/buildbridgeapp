// src/app/browse/page.tsx

'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

type Contractor = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string;
  area: string;
  tradeTypes: string[];
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  tier: 'LISTED' | 'PLUS' | 'PRO';
  yearsInBusiness: number | null;
  rating: number;
  reviewCount: number;
  licenseNumber: string;
  _count: { projects: number };
};

type SortOption = 'experience' | 'projects' | 'location';

const MIN_EXPERIENCE_OPTIONS = [0, 5, 10, 20];
const MIN_PROJECTS_OPTIONS = [0, 1, 3, 5];

function BrowsePageInner() {
  const searchParams = useSearchParams();
  const [contractors, setContractors] = useState<Contractor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<string>(searchParams.get('trade') ?? 'all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [minExperience, setMinExperience] = useState(0);
  const [minProjects, setMinProjects] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('experience');

  useEffect(() => {
    fetch('/api/contractors')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load contractors');
        return res.json();
      })
      .then(setContractors)
      .catch(() => setError('Could not load contractors right now. Please try again shortly.'));
  }, []);

  const availableTrades = useMemo(() => {
    if (!contractors) return [];
    const allTrades = contractors.flatMap((c) => c.tradeTypes);
    return Array.from(new Set(allTrades)).sort();
  }, [contractors]);

  const availableCities = useMemo(() => {
    if (!contractors) return [];
    return Array.from(new Set(contractors.map((c) => c.city))).sort();
  }, [contractors]);

  const filteredContractors = useMemo(() => {
    if (!contractors) return null;

    let result = contractors;
    if (selectedTrade !== 'all') {
      result = result.filter((c) => c.tradeTypes.includes(selectedTrade));
    }
    if (selectedCity !== 'all') {
      result = result.filter((c) => c.city === selectedCity);
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
    if (sortBy === 'experience') {
      result.sort((a, b) => (b.yearsInBusiness ?? 0) - (a.yearsInBusiness ?? 0));
    } else if (sortBy === 'projects') {
      result.sort((a, b) => b._count.projects - a._count.projects);
    } else if (sortBy === 'location') {
      result.sort((a, b) => `${a.city}${a.area}`.localeCompare(`${b.city}${b.area}`));
    }

    return result;
  }, [contractors, selectedTrade, selectedCity, minExperience, minProjects, sortBy]);

  const hasActiveFilters = selectedCity !== 'all' || minExperience > 0 || minProjects > 0;

  return (
    <>
      <Nav />

      <header className="bg-paper text-ink border-b border-line pt-11 pb-10">
        <div className="max-w-[1440px] mx-auto px-8">
          <h1 className="font-display font-light text-[clamp(28px,3.6vw,38px)]">
            Find your contractor
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] mx-auto px-8 py-10 w-full">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-4 mb-6">
            {error}
          </div>
        )}

        {!error && contractors === null && (
          <p className="text-stone text-sm">Loading contractors…</p>
        )}

        {contractors !== null && filteredContractors !== null && (
          <>
            {availableTrades.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-5">
                <button
                  onClick={() => setSelectedTrade('all')}
                  className={`text-[13px] px-3.5 py-2 rounded-full border transition-colors ${
                    selectedTrade === 'all'
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-paper text-stone border-line hover:border-ink'
                  }`}
                >
                  All trades
                </button>
                {availableTrades.map((trade) => (
                  <button
                    key={trade}
                    onClick={() => setSelectedTrade(trade)}
                    className={`text-[13px] px-3.5 py-2 rounded-full border transition-colors ${
                      selectedTrade === trade
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-paper text-stone border-line hover:border-ink'
                    }`}
                  >
                    {trade}
                  </button>
                ))}
              </div>
            )}

            {/* Filter + sort bar */}
            <div className="flex flex-wrap items-center gap-3 mb-6 pb-6 border-b border-line">
              <FilterSelect
                label="Location"
                value={selectedCity}
                onChange={setSelectedCity}
                options={[{ value: 'all', label: 'All locations' }, ...availableCities.map((c) => ({ value: c, label: c }))]}
              />
              <FilterSelect
                label="Min. experience"
                value={String(minExperience)}
                onChange={(v) => setMinExperience(Number(v))}
                options={MIN_EXPERIENCE_OPTIONS.map((n) => ({
                  value: String(n),
                  label: n === 0 ? 'Any experience' : `${n}+ years`,
                }))}
              />
              <FilterSelect
                label="Min. projects"
                value={String(minProjects)}
                onChange={(v) => setMinProjects(Number(v))}
                options={MIN_PROJECTS_OPTIONS.map((n) => ({
                  value: String(n),
                  label: n === 0 ? 'Any' : `${n}+ projects listed`,
                }))}
              />

              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSelectedCity('all');
                    setMinExperience(0);
                    setMinProjects(0);
                  }}
                  className="text-[13px] text-stone hover:text-ink underline underline-offset-2"
                >
                  Clear filters
                </button>
              )}

              <div className="ml-auto">
                <FilterSelect
                  label="Sort by"
                  value={sortBy}
                  onChange={(v) => setSortBy(v as SortOption)}
                  options={[
                    { value: 'experience', label: 'Most experience' },
                    { value: 'projects', label: 'Most projects' },
                    { value: 'location', label: 'Location (A–Z)' },
                  ]}
                />
              </div>
            </div>

            <p className="text-sm text-stone mb-6">
              {filteredContractors.length === 0
                ? 'No contractors match these filters yet.'
                : `${filteredContractors.length} verified contractor${filteredContractors.length === 1 ? '' : 's'}`}
            </p>

            {filteredContractors.length === 0 ? (
              <div className="border border-line rounded-md p-10 text-center bg-paper">
                <p className="text-stone font-medium mb-1">No contractors listed yet</p>
                <p className="text-sm text-stone">
                  Try different filters, or check back soon as more contractors are added.
                </p>
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
                      <div className="w-14 h-14 rounded-lg bg-ink text-paper font-display text-lg flex items-center justify-center shrink-0 overflow-hidden">
                        {c.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external Blob URL
                          <img src={c.logoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          c.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap mb-1">
                          <span className="font-display text-lg">{c.name}</span>
                          {c.verificationStatus === 'VERIFIED' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-sage bg-sage-soft border border-sage/25 rounded-full px-2.5 py-1">
                              ✓ Verified
                            </span>
                          )}
                          {c.tier === 'PRO' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-paper bg-ink rounded-full px-2.5 py-1 font-medium">
                              Pro
                            </span>
                          )}
                          {c.tier === 'PLUS' && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink bg-paper-dim border border-line rounded-full px-2.5 py-1 font-medium">
                              Plus
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-stone mb-3">
                          📍 {c.area}, {c.city} · License {c.licenseNumber}
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
                            <div>
                              <span className="font-medium block">
                                {c.rating.toFixed(1)} ★
                              </span>
                              <span className="text-xs text-stone">{c.reviewCount} reviews</span>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-stone">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[13px] px-3 py-2 rounded-md border border-line bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-ink cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function BrowsePage() {
  return (
    <Suspense fallback={null}>
      <BrowsePageInner />
    </Suspense>
  );
}
