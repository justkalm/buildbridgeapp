// src/app/page.tsx — Landing page.

import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const TRADE_CATEGORIES = [
  'RCC & Structural',
  'Electrical',
  'Waterproofing',
  'Interior Fit-out',
  'Plumbing',
  'Facade & Cladding',
];

export default function Home() {
  return (
    <>
      <Nav />

      <header className="pt-28 pb-24 text-center">
        <div className="max-w-[720px] mx-auto px-8">
          <p className="font-display text-3xl md:text-4xl text-ink mb-8 leading-tight">
            Kaam. Connected.
          </p>
          <h1 className="font-display font-light text-[clamp(34px,4.4vw,52px)] leading-[1.15] text-ink mb-7">
            Build with contractors who&apos;ve proven it before.
          </h1>
          <p className="text-[17px] leading-relaxed text-stone max-w-[480px] mx-auto mb-10">
            (kalm) connects developers with licensed contractors — every profile backed by
            verified project history, not just claims.
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <Link
              href="/browse"
              className="inline-flex items-center justify-center text-sm px-7 py-3.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
            >
              Browse Contractors
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center text-sm px-7 py-3.5 rounded-full border border-line text-ink hover:border-ink transition-colors"
            >
              Get Started
            </Link>
          </div>
          <p className="text-sm text-stone mt-6">
            Are you a contractor?{' '}
            <Link href="/contractor/signup" className="text-ink underline underline-offset-2 hover:text-stone">
              List your business
            </Link>
          </p>
        </div>
      </header>

      <section className="py-24 bg-paper-dim border-t border-line">
        <div className="max-w-[880px] mx-auto px-8">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-center text-ink mb-14">
            Every trade, one directory.
          </h2>

          <div className="flex flex-wrap justify-center gap-3">
            {TRADE_CATEGORIES.map((trade) => (
              <Link
                key={trade}
                href={`/browse?trade=${encodeURIComponent(trade)}`}
                className="text-sm px-5 py-2.5 rounded-full border border-line bg-paper text-ink hover:border-ink transition-colors"
              >
                {trade}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-line">
        <div className="max-w-[880px] mx-auto px-8">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-center text-ink mb-16">
            Browse, notify, negotiate.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {[
              { title: 'Browse verified profiles', body: 'Filter by location and trade, see real reviews and completed project history.' },
              { title: 'Request a quote', body: 'Create an account, shortlist contractors, and share your project details.' },
              { title: 'They get notified', body: 'Selected contractors receive an instant notification and reach out directly.' },
              { title: 'Negotiate & decide', body: 'You talk terms directly. No obligation either way.' },
            ].map((step) => (
              <div key={step.title} className="text-center md:text-left">
                <h4 className="font-display text-lg text-ink mb-2">{step.title}</h4>
                <p className="text-sm text-stone leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-line">
        <div className="max-w-[640px] mx-auto px-8 text-center">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-ink mb-6">
            A badge that means something.
          </h2>
          <p className="text-[15.5px] leading-relaxed text-stone mb-4">
            Every Verified contractor&apos;s license has been independently checked against the
            issuing state authority — not just submitted and taken at their word.
          </p>
          <p className="text-[15.5px] leading-relaxed text-stone mb-10">
            If we haven&apos;t confirmed a license yet, a contractor stays marked Pending. We&apos;d
            rather show fewer Verified profiles than let the badge stop meaning what it says.
          </p>
          <span className="inline-flex items-center gap-2 text-sm text-ink border border-line rounded-full px-5 py-2.5">
            ( verified — license checked independently )
          </span>
        </div>
      </section>

      <Footer />
    </>
  );
}
