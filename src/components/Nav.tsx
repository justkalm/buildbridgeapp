// src/components/Nav.tsx
//
// Redesigned around the (Kalm) logo: the parentheses ARE the mark now, no
// separate icon badge. Quiet by design — off-white background, hairline
// border instead of a solid dark bar, ink-colored text throughout.
//
// Mobile menu: the primary link set (Browse, Post a Project, List Your
// Business, Dashboard) used to be wrapped in `hidden md:flex` with
// nothing replacing it below 768px — meaning Browse and Dashboard were
// completely unreachable from the nav on every phone. The only route to
// /browse on mobile was the homepage hero button; a contractor who logged
// in on a phone (how most of them will) couldn't reach their own
// dashboard except by typing the URL directly. This adds a hamburger
// toggle that reveals the same links, plus sign-in/out, in a dropdown
// panel — desktop layout and behavior are unchanged.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Nav() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <nav className="sticky top-0 z-50 bg-paper/90 backdrop-blur-sm border-b border-line">
      <div className="max-w-[1440px] mx-auto px-8 h-[76px] flex items-center justify-between">
        <Link href="/" className="font-display text-2xl text-ink tracking-tight" onClick={closeMobile}>
          (kalm)
        </Link>

        <div className="hidden md:flex items-center gap-10">
          <Link href="/browse" className="text-sm text-stone hover:text-ink transition-colors">
            Browse Contractors
          </Link>
          {status === 'authenticated' && role === 'developer' && (
            <Link href="/post-project" className="text-sm text-stone hover:text-ink transition-colors">
              Post a Project
            </Link>
          )}
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

        <div className="hidden md:flex items-center gap-6">
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

        {/* Hamburger toggle — only rendered/visible below md, mirrors the
            `hidden md:flex` pattern used everywhere else in this file. */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden flex flex-col justify-center gap-1.5 w-8 h-8 -mr-1"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          <span
            className={`block h-[1.5px] bg-ink transition-transform ${mobileOpen ? 'translate-y-[6.5px] rotate-45' : ''}`}
          />
          <span className={`block h-[1.5px] bg-ink transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
          <span
            className={`block h-[1.5px] bg-ink transition-transform ${mobileOpen ? '-translate-y-[6.5px] -rotate-45' : ''}`}
          />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-line bg-paper px-8 py-5 flex flex-col gap-5">
          <Link href="/browse" className="text-sm text-ink" onClick={closeMobile}>
            Browse Contractors
          </Link>
          {status === 'authenticated' && role === 'developer' && (
            <Link href="/post-project" className="text-sm text-ink" onClick={closeMobile}>
              Post a Project
            </Link>
          )}
          {status !== 'authenticated' && (
            <Link href="/contractor/signup" className="text-sm text-ink" onClick={closeMobile}>
              List Your Business
            </Link>
          )}
          {status === 'authenticated' && (
            <Link
              href={role === 'contractor' ? '/contractor/dashboard' : '/dashboard'}
              className="text-sm text-ink"
              onClick={closeMobile}
            >
              Dashboard
            </Link>
          )}

          <div className="border-t border-line pt-5 flex flex-col gap-5">
            {status === 'loading' ? null : status === 'authenticated' ? (
              <>
                <span className="text-sm text-stone">{session.user?.name}</span>
                <button
                  onClick={() => {
                    closeMobile();
                    signOut({ callbackUrl: '/' });
                  }}
                  className="text-sm text-ink text-left"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-ink" onClick={closeMobile}>
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center text-sm px-5 py-2.5 rounded-full bg-ink text-paper w-fit"
                  onClick={closeMobile}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
