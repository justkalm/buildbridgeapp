// src/app/not-found.tsx
//
// The 404 page, e.g. a contractor profile that isn't public (unknown or not
// yet verified slug). Used to be the plain Next.js default; the profile page
// showed its own "not found" text with a 200 status instead, which Google
// counts as a soft 404.

import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="flex-1 flex flex-col items-center justify-center text-center py-24 px-5">
        <h1 className="font-display font-light text-[32px] text-ink mb-3">Page not found</h1>
        <p className="text-stone mb-8 max-w-[420px]">
          This page doesn&apos;t exist, or the contractor isn&apos;t listed publicly yet.
        </p>
        <Link
          href="/browse"
          className="inline-flex items-center justify-center text-sm px-7 py-3.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
        >
          Browse Contractors
        </Link>
      </main>
      <Footer />
    </>
  );
}
