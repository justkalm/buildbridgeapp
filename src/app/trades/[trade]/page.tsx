// src/app/trades/[trade]/page.tsx
//
// One page per trade, e.g. /trades/waterproofing-and-roofing: "Waterproofing
// & Roofing contractors in Mumbai" (SEO, 5 Nov 2026). Developers search
// Google by trade and city; before this there was no page to match those
// searches, only the Browse filter, which Google can't use.
//
// Server-rendered, so the whole list is in the HTML. Lists real verified
// contractors only (src/lib/trade-pages.ts). A trade with nobody listed yet
// shows an invitation to contractors instead and is kept out of Google
// (noindex here, left out of the sitemap) until someone is listed.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import ProfileImage from '@/components/ProfileImage';
import VerifiedBadge from '@/components/VerifiedBadge';
import { formatLocation } from '@/lib/location';
import { breadcrumbLd } from '@/lib/structured-data';
import { contractorsInTrade, tradeCounts } from '@/lib/trade-pages';
import { specialityLabel, tradeFromSlug, tradeOf, tradeSlug } from '@/lib/trade-types';
import { NEVER_INDEX } from '@/lib/site';

export async function generateMetadata({ params }: PageProps<'/trades/[trade]'>): Promise<Metadata> {
  const { trade: slug } = await params;
  const def = tradeFromSlug(slug);
  if (!def) return { title: 'Trade not found' };
  const count = (await contractorsInTrade(def.trade)).length;
  const description = `Verified ${def.trade} contractors in Mumbai: ${def.specialities.slice(0, 4).join(', ').toLowerCase()} and more. See their completed projects and request a quote directly on (kalm).`;
  return {
    title: `${def.trade} Contractors in Mumbai`,
    description,
    alternates: { canonical: `/trades/${slug}` },
    openGraph: { title: `${def.trade} Contractors in Mumbai | (kalm)`, description, url: `/trades/${slug}` },
    ...(count === 0 ? { robots: NEVER_INDEX } : {}),
  };
}

export default async function TradePage({ params }: PageProps<'/trades/[trade]'>) {
  const { trade: slug } = await params;
  const def = tradeFromSlug(slug);
  if (!def) notFound();

  const contractors = await contractorsInTrade(def.trade);
  const others = (await tradeCounts()).filter((t) => t.trade !== def.trade && t.count > 0);
  const lower = def.trade.toLowerCase();

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: 'Trades', path: '/trades' },
          { name: def.trade, path: `/trades/${slug}` },
        ])}
      />
      <Nav />

      <header className="pt-12 pb-10 border-b border-line">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-stone mb-6">
            <Link href="/trades" className="hover:text-ink underline underline-offset-2">Trades</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span>{def.trade}</span>
          </nav>
          <h1 className="font-logo font-light text-[clamp(32px,4.4vw,54px)] leading-[1.08] text-ink mb-5">
            {def.trade} contractors in Mumbai
          </h1>
          <p className="text-[17px] leading-relaxed text-stone max-w-[640px]">
            Verified {lower} contractors, checked by the (kalm) team. Compare their completed
            projects, then request a quote directly. No middleman.
          </p>
          <p className="text-sm text-stone mt-5 max-w-[760px]">
            <span className="text-ink">Covers:</span> {def.specialities.join(', ')}.
          </p>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-14">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
            {contractors.length > 0 ? (
              <>
                <h2 className="font-logo text-2xl text-ink mb-8">
                  {contractors.length} verified {contractors.length === 1 ? 'contractor' : 'contractors'}
                </h2>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {contractors.map((c) => {
                    const specialities = c.tradeTypes.filter((v) => tradeOf(v) === def.trade).map(specialityLabel);
                    return (
                      <li key={c.slug}>
                        <Link
                          href={`/contractors/${c.slug}`}
                          className="flex gap-4 h-full p-5 rounded-2xl border border-line bg-paper hover:border-ink transition-colors"
                        >
                          <div className="relative w-14 h-14 rounded-xl bg-paper-dim border border-line text-ink font-display text-lg flex items-center justify-center shrink-0 overflow-hidden">
                            {c.logoUrl ? (
                              <ProfileImage src={c.logoUrl} alt={`${c.name} logo`} fill sizes="56px" className="object-cover" />
                            ) : (
                              c.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-display text-lg text-ink">{c.name}</h3>
                              <VerifiedBadge reviewPending={c.reverifyPending} />
                            </div>
                            <p className="text-[13.5px] text-stone mb-2">
                              {formatLocation(c.area, c.city)}
                              {c.yearsInBusiness ? ` · ${c.yearsInBusiness}+ years` : ''}
                              {c.projectCount > 0 ? ` · ${c.projectCount} ${c.projectCount === 1 ? 'project' : 'projects'}` : ''}
                            </p>
                            {specialities.length > 0 && (
                              <p className="text-[13.5px] text-ink">{specialities.join(', ')}</p>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-sm text-stone mt-8">
                  Want to filter by area, experience or number of projects?{' '}
                  <Link href={`/browse?trade=${encodeURIComponent(def.trade)}`} className="text-ink underline underline-offset-2 hover:text-stone">
                    Open {def.trade} on Browse
                  </Link>
                </p>
              </>
            ) : (
              <div className="max-w-[560px]">
                <h2 className="font-logo text-2xl text-ink mb-3">No verified {lower} contractors yet</h2>
                <p className="text-stone mb-6">
                  We&apos;re adding contractors every week. Do you work in {lower} in Mumbai? List your
                  business and get quote requests from developers.
                </p>
                <Link
                  href="/contractor/signup"
                  className="inline-flex items-center justify-center text-sm px-7 py-3.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
                >
                  List your business
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="py-14 bg-paper-dim border-t border-line">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
            <div className="max-w-[760px]">
            <h2 className="font-logo text-2xl text-ink mb-4">What Verified means</h2>
            <p className="text-[15.5px] leading-relaxed text-stone mb-3">
              Before a contractor is marked Verified, our team reviews their GST and registration
              documents, checks their GSTIN on the GST portal, and speaks with them directly, by phone
              or in person. Until all three are done, they stay Pending and aren&apos;t listed here.
            </p>
            </div>
          </div>
        </section>

        {others.length > 0 && (
          <section className="py-14 border-t border-line">
            <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
              <h2 className="font-logo text-2xl text-ink mb-6">Other trades</h2>
              <ul className="flex flex-wrap gap-3">
                {others.map((t) => (
                  <li key={t.trade}>
                    <Link
                      href={`/trades/${tradeSlug(t.trade)}`}
                      className="inline-block text-sm px-5 py-2.5 rounded-full border border-line bg-paper text-ink hover:border-ink transition-colors"
                    >
                      {t.trade}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
