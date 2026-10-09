// src/app/about/page.tsx
//
// Founder bios draw only on facts actually known to be true (Moiz's
// Northstar Web work and family manufacturing business) plus each
// person's real role at (kalm) — no invented years of
// experience, past employers, or achievements. Hassan's bio is kept more
// general since no verified background was available for him; expand it
// with real specifics rather than invented ones if/when they're provided.

import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const FOUNDERS = [
  {
    name: 'Moiz Patrawala',
    role: 'Co-founder, Tech & Finance',
    bio: "Moiz co-founded Northstar Web, a Mumbai studio building sites for small businesses, and has spent time on the finance and operations side of his family's manufacturing business. That mix, building software on one side and running a real operating business on the other, is where (kalm) came from. He leads product and engineering, and keeps an eye on the numbers underneath it.",
  },
  {
    name: 'Hassan Birya',
    role: 'Co-founder, Legal & Finance',
    bio: "Hassan handles the legal and financial groundwork (kalm) is built on: the contracts, the compliance, the parts of a marketplace that have to be right before anything else can work.",
  },
  {
    name: 'Shaheer Motorwala',
    role: 'Co-founder, Marketing & Growth',
    bio: "Shaheer is focused on getting the platform in front of the developers and contractors who need it, and making sure growth doesn't come at the cost of what the Verified badge is supposed to mean.",
  },
];

// Team members who are not co-founders. Bios stay role-based: no invented
// background until real, verified specifics are provided.
const TEAM = [
  {
    name: 'Anas Maklai',
    role: 'Operations',
    bio: 'Anas supports the day-to-day operations behind (kalm), helping keep things running smoothly for the developers and contractors who use the platform.',
  },
];

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function AboutPage() {
  return (
    <>
      <Nav />

      <header className="pt-28 pb-20 text-center">
        <div className="max-w-[680px] mx-auto px-5 sm:px-8">
          <h1 className="font-display font-light text-[clamp(32px,4vw,46px)] leading-[1.15] text-ink mb-6">
            Built by people tired of the old way.
          </h1>
          <p className="text-[17px] leading-relaxed text-stone max-w-[480px] mx-auto">
            (kalm) exists to make finding a contractor as straightforward as it should&apos;ve
            always been: contractors whose documents and GSTIN we check, project history with photos, timelines and sizes, and no middleman on the deal.
          </p>
        </div>
      </header>

      <section className="py-24 border-t border-line">
        <div className="max-w-[880px] mx-auto px-5 sm:px-8">
          <h2 className="font-display font-light text-[clamp(28px,3.2vw,38px)] text-center text-ink mb-16">
            Meet the founders.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {FOUNDERS.map((f) => (
              <div key={f.name}>
                <div className="w-20 h-20 rounded-full bg-ink text-paper font-display text-xl flex items-center justify-center mx-auto mb-5">
                  {initials(f.name)}
                </div>
                <h3 className="font-display text-lg text-ink mb-1 text-center">{f.name}</h3>
                <p className="text-xs text-sage font-medium mb-4 tracking-wide uppercase text-center">{f.role}</p>
                <p className="text-sm text-stone leading-relaxed text-left">{f.bio}</p>
              </div>
            ))}
            {TEAM.map((t) => (
              <div key={t.name} className="md:col-start-2">
                <div className="w-20 h-20 rounded-full bg-ink text-paper font-display text-xl flex items-center justify-center mx-auto mb-5">
                  {initials(t.name)}
                </div>
                <h3 className="font-display text-lg text-ink mb-1 text-center">{t.name}</h3>
                <p className="text-xs text-sage font-medium mb-4 tracking-wide uppercase text-center">{t.role}</p>
                <p className="text-sm text-stone leading-relaxed text-left">{t.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
