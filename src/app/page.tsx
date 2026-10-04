// src/app/page.tsx — Landing page.
//
// Signed-in people never see it (owner, 1 Oct 2026): opening (kalm), the
// logo link, or the Home Screen app (its start_url is "/", see
// manifest.ts) takes a developer to /dashboard and a contractor to
// /contractor/dashboard. Only signed-out visitors get the landing page.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import KalmTrace from '@/components/KalmTrace';
import { ALL_TRADES, HOMEPAGE_TRADES } from '@/lib/trade-types';

export default async function Home() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === 'contractor') redirect('/contractor/dashboard');
  if (role === 'developer') redirect('/dashboard');

  return (
    <>
      <Nav />

      <header className="pt-10 md:pt-12 pb-20 md:pb-24">
        <KalmTrace />
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 mt-9 md:mt-10 grid md:grid-cols-12 gap-x-12 gap-y-9 items-end">
          <div className="md:col-span-7">
            <p className="font-logo text-[15px] md:text-[17px] text-stone mb-5 tracking-[0.22em]">
              Kaam. Connected.
            </p>
            <h1 className="font-logo font-light text-[clamp(38px,5.4vw,70px)] leading-[1.06] tracking-[0.005em] text-ink">
              Build with contractors who&apos;ve proven it before.
            </h1>
          </div>
          <div className="md:col-span-5 md:pb-2">
            <p className="text-[17px] leading-relaxed text-stone max-w-[420px] mb-8">
              Find licensed contractors in Mumbai, and see their finished work before you ask for a quote.
            </p>
            <div className="flex gap-4 flex-wrap">
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
                Sign up as a developer
              </Link>
            </div>
            <p className="text-sm text-stone mt-6">
              Are you a contractor?{' '}
              <Link href="/contractor/signup" className="text-ink underline underline-offset-2 hover:text-stone">
                List your business
              </Link>
            </p>
          </div>
        </div>
      </header>

      <section className="py-24 bg-paper-dim border-t border-line">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
          <h2 className="font-logo font-light tracking-[0.01em] text-[clamp(30px,3.6vw,46px)] text-ink mb-12">
            Every trade, one directory.
          </h2>

          <div className="flex flex-wrap gap-3">
            {/* The trades almost every project hires (KALM-167); the rest
                are one tap away in Browse's trade filter. */}
            {HOMEPAGE_TRADES.map((trade) => (
              <Link
                key={trade}
                href={`/browse?trade=${encodeURIComponent(trade)}`}
                className="text-sm px-5 py-2.5 rounded-full border border-line bg-paper text-ink hover:border-ink transition-colors"
              >
                {trade}
              </Link>
            ))}
            <Link
              href="/browse"
              className="text-sm px-5 py-2.5 rounded-full text-stone underline underline-offset-2 hover:text-ink transition-colors"
            >
              All {ALL_TRADES.length} trades
            </Link>
          </div>
        </div>
      </section>

      {/* Trust comes straight after the trade shortcuts: "Verified" is the
          thing that sets (kalm) apart, so it's explained before anything
          else about how the site works. */}
      <section className="py-24 border-t border-line">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
          <h2 className="font-logo font-light tracking-[0.01em] text-[clamp(30px,3.6vw,46px)] text-ink mb-8">
            A badge that means something.
          </h2>
          <div className="max-w-[560px]">
            <p className="text-[15.5px] leading-relaxed text-stone mb-4 text-left sm:text-justify">
              Before a contractor is marked Verified, our team does three things, not just take
              their word for it:
            </p>
            <ul className="text-[15.5px] leading-relaxed text-stone text-left mb-4 list-disc list-outside pl-5 space-y-1.5">
              <li>Review copies of their license, GST, and registration documents</li>
              <li>Check their GSTIN against the GST portal</li>
              <li>Speak with them directly, by phone or in person</li>
            </ul>
            <p className="text-[15.5px] leading-relaxed text-stone mb-10 text-left sm:text-justify">
              If we haven&apos;t completed all three yet, a contractor stays marked Pending. We&apos;d
              rather show fewer Verified profiles than let the badge stop meaning what it says.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm text-ink border border-line rounded-full px-5 py-2.5">
            ( verified: documents & GSTIN checked, contractor contacted directly )
          </span>
        </div>
      </section>

      {/* One "how it works" for developers. This used to be two sections
          ("Browse, notify, negotiate" and "More than a directory") that
          covered the same journey twice; the owner asked for a shorter
          homepage, so they're merged into these four steps. */}
      <section className="py-24 border-t border-line bg-paper-dim">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
          <h2 className="font-logo font-light tracking-[0.01em] text-[clamp(30px,3.6vw,46px)] text-ink mb-14">
            How it works.
          </h2>

          <ol className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
            {[
              {
                title: 'Find verified contractors',
                body: 'Filter by trade and location. See project history with photos, timelines and sizes.',
              },
              {
                title: 'Shortlist and message',
                body: 'Save contractors, compare them side by side, and ask questions in the app.',
              },
              {
                title: 'Visit their finished sites',
                body: 'Pick a few completed projects to see in person. You get a calendar invite once it\'s set.',
              },
              {
                title: 'Request a quote',
                body: 'Share your project details. You deal with the contractor directly, no obligation.',
              },
            ].map((step, i) => (
              <li key={step.title} className="text-left">
                <p className="text-xs font-medium tracking-wider text-stone mb-2">STEP {i + 1}</p>
                <h3 className="font-logo text-xl text-ink mb-2 tracking-[0.01em]">{step.title}</h3>
                <p className="text-sm text-stone leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="flex gap-4 flex-wrap mt-16">
            <Link
              href="/browse"
              className="inline-flex items-center justify-center text-sm px-7 py-3.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
            >
              Browse Contractors
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center text-sm px-7 py-3.5 rounded-full border border-line bg-paper text-ink hover:border-ink transition-colors"
            >
              Sign up as a developer
            </Link>
          </div>
        </div>
      </section>

      {/* Contractors get one slim banner rather than a full section; the
          details of what a listing offers live on the signup page. */}
      <section className="py-12 border-t border-line">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-logo text-2xl text-ink tracking-[0.01em]">Are you a contractor?</p>
            <p className="text-sm text-stone mt-1">
              Show your completed work and get quote requests from developers, free during the trial.
            </p>
          </div>
          <Link
            href="/contractor/signup"
            className="shrink-0 inline-flex items-center justify-center text-sm px-7 py-3.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
          >
            List your business
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
