// src/app/page.tsx — Landing page.

import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { HOMEPAGE_TRADE_CATEGORIES } from '@/lib/trade-types';

export default function Home() {
  return (
    <>
      <Nav />

      <header className="pt-28 pb-24 text-center">
        <div className="max-w-[720px] mx-auto px-5 sm:px-8">
          <p className="font-display text-3xl md:text-4xl text-ink mb-8 leading-tight">
            Kaam. Connected.
          </p>
          <h1 className="font-display font-light text-[clamp(34px,4.4vw,52px)] leading-[1.15] text-ink mb-7">
            Build with contractors who&apos;ve proven it before.
          </h1>
          <p className="text-[17px] leading-relaxed text-stone max-w-[480px] mx-auto mb-10">
            (kalm) connects developers with licensed contractors. Verified means we&apos;ve checked
            their documents and GSTIN and spoken to them directly. Every profile shows project
            history with photos, timelines and sizes.
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
        <div className="max-w-[880px] mx-auto px-5 sm:px-8">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-center text-ink mb-14">
            Every trade, one directory.
          </h2>

          <div className="flex flex-wrap justify-center gap-3">
            {HOMEPAGE_TRADE_CATEGORIES.map((category) => (
              <Link
                key={category.label}
                href={`/browse?category=${encodeURIComponent(category.label)}`}
                className="text-sm px-5 py-2.5 rounded-full border border-line bg-paper text-ink hover:border-ink transition-colors"
              >
                {category.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-line">
        <div className="max-w-[880px] mx-auto px-5 sm:px-8">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-center text-ink mb-16">
            Browse, notify, negotiate.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {[
              { title: 'Browse verified profiles', body: 'Filter by location and trade. See reviews and project history with photos, timelines and sizes.' },
              { title: 'Request a quote', body: 'Create an account, shortlist contractors, and share your project details.' },
              { title: 'They get notified', body: 'Your request lands on the contractor\'s dashboard, and they reach out to you directly.' },
              { title: 'Negotiate & decide', body: 'You talk terms directly. No obligation either way.' },
            ].map((step) => (
              <div key={step.title} className="text-center md:text-left">
                <h3 className="font-display text-lg text-ink mb-2">{step.title}</h3>
                <p className="text-sm text-stone leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-line bg-paper-dim">
        <div className="max-w-[880px] mx-auto px-5 sm:px-8">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-center text-ink mb-4">
            More than a directory.
          </h2>
          <p className="text-[15.5px] leading-relaxed text-stone text-center max-w-[520px] mx-auto mb-16">
            Tools for developers to compare contractors and see their work before deciding.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {[
              {
                icon: '\u{1F4CB}',
                title: 'Shortlist and compare',
                body: 'Save contractors to a shortlist, compare them side by side, and keep private notes only you can see.',
              },
              {
                icon: '\u{1F4AC}',
                title: 'Message in the app',
                body: 'Talk to contractors without leaving (kalm). Ask questions and share project details in one thread.',
              },
              {
                icon: '\u{1F3D7}\uFE0F',
                title: 'Visit their finished sites',
                body: 'Pick 3 to 5 completed projects to see in person and offer 3 times. You get a calendar invite once it is set.',
              },
              {
                icon: '\u2B50',
                title: 'Reviews from past clients',
                body: 'The (kalm) team collects reviews directly from the named past client, so they are not written by the contractor.',
              },
            ].map((item) => (
              <div key={item.title} className="text-center md:text-left">
                <h3 className="font-display text-lg text-ink mb-2">
                  <span aria-hidden="true" className="mr-2">{item.icon}</span>
                  {item.title}
                </h3>
                <p className="text-sm text-stone leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-4 flex-wrap justify-center mt-16">
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
              Create an account
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-line">
        <div className="max-w-[880px] mx-auto px-5 sm:px-8">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-center text-ink mb-4">
            Built for contractors too.
          </h2>
          <p className="text-[15.5px] leading-relaxed text-stone text-center max-w-[520px] mx-auto mb-16">
            A listing on (kalm) isn&apos;t just a directory entry, it&apos;s a dashboard you actually
            control.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                title: 'A profile that shows your work',
                body: 'Add completed projects with photos, timelines, and square footage for developers to look through.',
              },
              {
                title: 'Leads land in one place',
                body: 'See every quote request as it comes in, with the developer\u2019s contact details, right in your dashboard.',
              },
              {
                title: 'You stay in control',
                body: 'Update your bio, photos and projects any time and your listing stays live. Changing checked details like your location or phone just adds an "update in review" note to your badge until we check it.',
              },
            ].map((item) => (
              <div key={item.title} className="text-center md:text-left">
                <h3 className="font-display text-lg text-ink mb-2">{item.title}</h3>
                <p className="text-sm text-stone leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <Link
              href="/contractor/signup"
              className="inline-flex items-center justify-center text-sm px-7 py-3.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
            >
              List your business
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-line bg-paper-dim">
        <div className="max-w-[640px] mx-auto px-5 sm:px-8 text-center">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-ink mb-6">
            A badge that means something.
          </h2>
          <div className="max-w-[520px] mx-auto">
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

      <Footer />
    </>
  );
}
