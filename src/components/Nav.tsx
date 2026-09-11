// src/components/Nav.tsx
//
// Redesigned around the (Kalm) logo: the parentheses ARE the mark now, no
// separate icon badge. Quiet by design — off-white background, hairline
// border instead of a solid dark bar, ink-colored text throughout.

'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Nav() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role;

  return (
    <nav className="sticky top-0 z-50 bg-paper/90 backdrop-blur-sm border-b border-line">
      <div className="max-w-[1440px] mx-auto px-8 h-[76px] flex items-center justify-between">
        <Link href="/" className="font-display text-2xl text-ink tracking-tight">
          (kalm)
        </Link>

        <div className="hidden md:flex items-center gap-10">
          <Link href="/browse" className="text-sm text-stone hover:text-ink transition-colors">
            Browse Contractors
          </Link>
          {status !== 'authenticated' && (
            <Link href="/contractor/signup" className="text-sm text-stone hover:text-ink transition-colors">
              List Your Business
            </Link>
          )}
          {status === 'authenticated' && (
            <Link
              href={role === 'contractor' ? '/contractor/dashboard' : '/dashboard'}
              className="text-sm text-stone hover:text-ink transition-colors"
            >
              Dashboard
            </Link>
          )}
        </div>

        <div className="flex items-center gap-6">
          {status === 'loading' ? null : status === 'authenticated' ? (
            <>
              <span className="text-sm text-ink">{session.user?.name}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-stone hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-ink hover:text-stone transition-colors">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full bg-ink text-paper hover:bg-stone transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
