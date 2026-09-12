// src/components/Footer.tsx

'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function Footer() {
  const { status, data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;

  return (
    <footer className="bg-paper-dim text-stone pt-16 pb-8 mt-auto border-t border-line">
      <div className="max-w-[1440px] mx-auto px-8">
        {/*
          Ad banner slot — placeholder only, no ad network wired up yet.
          Intentionally plain (dashed border, "Advertise here" label) so
          it reads as an empty slot rather than a broken image once real
          ad creative starts filling it. Swap the inner div for whatever
          the actual ad unit turns out to be (self-sold banner img+link,
          or a network's embed script) when that's ready.
        */}
        <div className="mb-12 border border-dashed border-line rounded-md h-24 flex items-center justify-center text-xs text-stone/70">
          Advertise here — contact us for placements
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 pb-12 border-b border-line">
          <div>
            <div className="font-display text-xl text-ink mb-3.5">(kalm)</div>
            <p className="text-sm leading-relaxed max-w-[260px]">
              Connecting developers, licensed contractors, and material suppliers on one verified network.
            </p>
          </div>
          <div>
            <h4 className="text-xs text-stone mb-4">Platform</h4>
            <ul className="flex flex-col gap-3">
              <li><Link href="/browse" className="text-sm hover:text-ink transition-colors">Browse Contractors</Link></li>
              {status !== 'authenticated' || role === 'developer' ? (
                <li><Link href="/post-project" className="text-sm hover:text-ink transition-colors">Post a Project</Link></li>
              ) : null}
            </ul>
          </div>
          <div>
            <h4 className="text-xs text-stone mb-4">For Business</h4>
            <ul className="flex flex-col gap-3">
              <li><Link href="/signup" className="text-sm hover:text-ink transition-colors">Register as Developer</Link></li>
              <li><Link href="/contractor/signup" className="text-sm hover:text-ink transition-colors">List Your Business</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs text-stone mb-4">Company</h4>
            <ul className="flex flex-col gap-3">
              <li><Link href="/about" className="text-sm hover:text-ink transition-colors">About</Link></li>
              <li><Link href="/contact" className="text-sm hover:text-ink transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-7 text-[13px]">
          <span>© {new Date().getFullYear()} (kalm). All rights reserved.</span>
          <span>Mumbai, India</span>
        </div>
      </div>
    </footer>
  );
}
