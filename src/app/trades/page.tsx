// src/app/trades/page.tsx
//
// Every trade on one page, each linking to its own page (/trades/<slug>)
// with how many verified contractors it has (SEO, 5 Nov 2026). Gives
// Google, and people, a plain route to every trade page.

import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { tradeCounts } from '@/lib/trade-pages';
import { TRADES, tradeSlug } from '@/lib/trade-types';

export const metadata: Metadata = {
  title: 'Contractors in Mumbai by Trade',
  description:
    'Find verified contractors in Mumbai by trade: civil and RCC, waterproofing, electrical, plumbing, fire safety, facade, HVAC, lifts, interiors and more.',
  alternates: { canonical: '/trades' },
};

export default async function TradesIndexPage() {
  const counts = new Map((await tradeCounts()).map((t) => [t.trade, t.count]));

  return (
    <>
      <Nav />
      <header className="pt-12 pb-10 border-b border-line">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
          <h1 className="font-logo font-light text-[clamp(32px,4.4vw,54px)] leading-[1.08] text-ink mb-5">
            Contractors in Mumbai, by trade
          </h1>
          <p className="text-[17px] leading-relaxed text-stone max-w-[640px]">
            Every trade a building needs, from groundworks to lifts. Pick one to see the verified
            contractors who do it.
          </p>
        </div>
      </header>
      <main className="flex-1 py-14">
        <ul className="max-w-[1180px] mx-auto px-5 sm:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TRADES.map((t) => {
            const count = counts.get(t.trade) ?? 0;
            return (
              <li key={t.trade}>
                <Link
                  href={`/trades/${tradeSlug(t.trade)}`}
                  className="block h-full p-5 rounded-2xl border border-line bg-paper hover:border-ink transition-colors"
                >
                  <h2 className="font-display text-lg text-ink mb-1">{t.trade}</h2>
                  <p className="text-[13px] text-stone mb-3">
                    {count > 0 ? `${count} verified ${count === 1 ? 'contractor' : 'contractors'}` : 'Contractors coming soon'}
                  </p>
                  <p className="text-[13px] text-stone leading-relaxed">
                    {t.specialities.slice(0, 5).join(', ')}
                    {t.specialities.length > 5 ? ' and more' : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <Footer />
    </>
  );
}
