// src/app/pricing/page.tsx
//
// The real pricing page — this is what "See upgrade options" links to now
// (was a placeholder pointing at the dashboard itself, see
// src/app/contractor/dashboard/page.tsx). Pricing itself is explicitly
// TEMPORARY per the person's own framing ("this is temporary rn") — the
// numbers (₹750/₹1500) and feature list live here as plain data at the
// top of the file specifically so they're a five-second edit later, not
// scattered through JSX.
//
// No payment integration wired up yet — the CTA buttons currently route
// to /contact, since there's no billing flow to actually charge a card
// through. Swap those hrefs once Razorpay (or whichever processor) is
// actually integrated.

import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const TIERS = [
  {
    name: 'Listed',
    price: 'Free',
    priceSuffix: '',
    description: 'Get discovered. No cost to list your business.',
    features: ['Listed on the (kalm) directory', 'Up to 5 full leads per month'],
    cta: 'Get started',
    href: '/contractor/signup',
    highlighted: false,
  },
  {
    name: 'Plus',
    price: '₹750',
    priceSuffix: '/month',
    description: 'For contractors ready to stop missing leads.',
    features: [
      'Everything in Listed',
      'Unlimited leads — no monthly cap',
      'Eligible for project-post alerts from our team',
    ],
    cta: 'Upgrade to Plus',
    href: '/contact',
    highlighted: true,
  },
  {
    name: 'Pro',
    price: '₹1,500',
    priceSuffix: '/month',
    description: 'Priority visibility, and work delivered to your inbox.',
    features: [
      'Everything in Plus',
      'Priority placement in search results',
      'Promotional emails when developers are looking for your trade',
    ],
    cta: 'Upgrade to Pro',
    href: '/contact',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 w-full">
        <section className="py-20 px-8 text-center border-b border-line">
          <h1 className="font-display font-light text-[clamp(32px,4vw,46px)] text-ink mb-4">
            Simple pricing, real leads.
          </h1>
          <p className="text-[15.5px] text-stone max-w-[480px] mx-auto">
            Start free. Upgrade when leads start costing you more to miss than to answer.
          </p>
          <p className="text-xs text-stone/70 mt-4">Pricing shown is introductory and may change.</p>
        </section>

        <section className="py-16 px-8">
          <div className="max-w-[1080px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-[10px] p-8 flex flex-col ${
                  tier.highlighted
                    ? 'bg-ink text-paper shadow-[0_20px_50px_-16px_rgba(10,10,11,0.35)] md:-translate-y-3'
                    : 'bg-paper border border-line'
                }`}
              >
                {tier.highlighted && (
                  <span className="inline-flex items-center self-start text-[11px] font-medium uppercase tracking-wide bg-sage text-paper px-2.5 py-1 rounded-full mb-4">
                    Most popular
                  </span>
                )}

                <h2 className={`font-display text-2xl mb-1 ${tier.highlighted ? 'text-paper' : 'text-ink'}`}>
                  {tier.name}
                </h2>
                <p className={`text-sm mb-6 ${tier.highlighted ? 'text-paper/70' : 'text-stone'}`}>
                  {tier.description}
                </p>

                <div className="mb-8">
                  <span className={`font-display text-4xl ${tier.highlighted ? 'text-paper' : 'text-ink'}`}>
                    {tier.price}
                  </span>
                  {tier.priceSuffix && (
                    <span className={`text-sm ${tier.highlighted ? 'text-paper/70' : 'text-stone'}`}>
                      {tier.priceSuffix}
                    </span>
                  )}
                </div>

                <ul className="flex flex-col gap-3 mb-10 flex-1">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className={`text-sm flex items-start gap-2.5 ${
                        tier.highlighted ? 'text-paper/90' : 'text-stone'
                      }`}
                    >
                      <span className={tier.highlighted ? 'text-sage' : 'text-sage'} aria-hidden>
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.href}
                  className={`inline-flex items-center justify-center text-sm font-medium px-6 py-3 rounded-full transition-colors ${
                    tier.highlighted
                      ? 'bg-paper text-ink hover:bg-paper/90'
                      : 'bg-ink text-paper hover:bg-stone'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 px-8 border-t border-line">
          <div className="max-w-[640px] mx-auto text-center">
            <h2 className="font-display font-light text-2xl text-ink mb-3">Questions about a plan?</h2>
            <p className="text-sm text-stone mb-6">
              Pricing is new and we&apos;re still refining it — reach out and we&apos;ll walk you
              through what fits.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center text-sm px-6 py-3 rounded-full border border-line text-ink hover:border-ink transition-colors"
            >
              Contact us
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
