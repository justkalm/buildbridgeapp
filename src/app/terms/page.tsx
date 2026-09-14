// src/app/terms/page.tsx
//
// PLACEHOLDER — not legal-reviewed. This exists so the signup forms have
// something real to link to (rather than a dead link or nothing at all),
// but the actual content needs review/drafting by Hassan (Legal &
// Finance co-founder, per project notes) before this is treated as the
// real, binding terms. The visible banner at the top says exactly that —
// don't remove it without an actual legal review having happened.

import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 max-w-[720px] mx-auto px-8 py-14 w-full">
        <div className="mb-8 px-4 py-3 rounded-[6px] bg-paper-dim border border-line text-sm text-stone">
          <strong className="text-ink">Placeholder — under legal review.</strong> This page is a
          draft outline, not final terms. It will be replaced once reviewed.
        </div>

        <h1 className="font-display font-light text-[32px] mb-2">Terms &amp; Conditions</h1>
        <p className="text-stone text-sm mb-10">Last updated: draft, not yet published</p>

        <div className="flex flex-col gap-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="font-display text-xl mb-2">1. What (kalm) is</h2>
            <p className="text-stone">
              (kalm) is a platform that connects property developers with licensed contractors.
              We facilitate introductions and quote requests — we are not a party to any
              agreement, contract, or transaction between a developer and a contractor.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">2. Accounts</h2>
            <p className="text-stone">
              You&apos;re responsible for the accuracy of information you provide, and for keeping
              your account credentials secure. Contractor listings marked &quot;Verified&quot; have had
              their license number checked against the relevant state authority — this does not
              constitute a guarantee of workmanship, timeliness, or business conduct.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">3. No liability for outcomes between users</h2>
            <p className="text-stone">
              Any agreement, project, payment, or dispute between a developer and a contractor is
              solely between those parties. (kalm) is not responsible for the quality, timing,
              safety, or legality of any work performed, or for any loss arising from a connection
              made through the platform.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">4. Acceptable use</h2>
            <p className="text-stone">
              Don&apos;t submit false information, impersonate another business or person, or use
              the platform to harass, defraud, or spam other users.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">5. Changes</h2>
            <p className="text-stone">
              We may update these terms as the product changes. Material changes will be
              communicated before they take effect.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">6. Contact</h2>
            <p className="text-stone">
              Questions about these terms can be sent via the{' '}
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
