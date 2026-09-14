// src/app/privacy/page.tsx
//
// PLACEHOLDER — not legal-reviewed. Same reasoning as terms/page.tsx.
// Worth being especially careful with this one specifically: the project
// notes mention planning to share contractor data with material suppliers
// (with consent) and the company is incorporating in India, which brings
// this under DPDP Act (Digital Personal Data Protection Act) obligations
// — disclosure requirements, deletion rights, etc. This draft outlines the
// right SECTIONS to have; the actual legal substance in each section still
// needs real review, not just this skeleton.

import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[720px] mx-auto px-8 py-14 w-full">
        <div className="mb-8 px-4 py-3 rounded-[6px] bg-paper-dim border border-line text-sm text-stone">
          <strong className="text-ink">Placeholder — under legal review.</strong> This page is a
          draft outline, not a final privacy policy. It will be replaced once reviewed.
        </div>

        <h1 className="font-display font-light text-[32px] mb-2">Privacy Policy</h1>
        <p className="text-stone text-sm mb-10">Last updated: draft, not yet published</p>

        <div className="flex flex-col gap-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-display text-xl mb-2">1. What we collect</h2>
            <p className="text-stone">
              Account details you provide (name, email, phone, business information for
              contractors), project and quote-request details, and basic usage data needed to
              operate the platform.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">2. How we use it</h2>
            <p className="text-stone">
              To operate the marketplace — matching developers with contractors, sending
              notifications about quote requests and project alerts, and verifying contractor
              licenses.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">3. Sharing with third parties</h2>
            <p className="text-stone">
              We don&apos;t sell personal data by default. Contractor business information may be
              shared with material-supplier partners, but only where the contractor has
              explicitly opted in via the data-sharing setting in their dashboard. Developer
              contact information is only released to the specific contractor a quote request or
              project alert was sent to.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">4. Your rights</h2>
            <p className="text-stone">
              You can request access to, correction of, or deletion of your personal data by
              contacting us. Contractors can withdraw data-sharing consent at any time from their
              dashboard.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">5. Data storage &amp; security</h2>
            <p className="text-stone">
              Data is stored with our infrastructure providers and protected with standard
              security practices, including encrypted connections and access controls.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">6. Cookies</h2>
            <p className="text-stone">
              We use cookies necessary for the site to function, such as keeping you signed in.
              See our cookie notice for details.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">7. Contact</h2>
            <p className="text-stone">
              Questions about this policy or your data can be sent via the{' '}
              <a href="/contact" className="text-ink underline underline-offset-2">
                contact page
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
