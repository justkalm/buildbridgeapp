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
//
// Notification badge: for a signed-in developer or contractor, the
// Dashboard link shows how many things need their attention: unread
// in-app messages plus site visits the other side has acted on (polled
// every minute via useUnreadMessages). On mobile a dot on the hamburger hints
// that there's something inside the menu worth opening.
//
// Messages icon: unread messages have their own home now (/messages), so
// they get their own entry, Instagram-DM style: a chat icon with a red
// count bubble. It sits in the top bar itself on phones too, just left of
// the hamburger, because a reply is the thing people most want to spot
// without opening a menu. The mobile menu also keeps a plain "Messages"
// link for anyone who looks for it there. To avoid counting a message
// twice, the Dashboard badge (and the hamburger dot) now cover only the
// OTHER notifications (site visits, quote updates...), i.e. total minus
// messages. `messages` is read defensively so an older unread response
// without the field just shows no message badge instead of breaking.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Wordmark from '@/components/Wordmark';
import { useSession, signOut } from 'next-auth/react';
import { useUnreadMessages } from '@/lib/use-unread-messages';

// Speech-bubble outline icon with an unread bubble on its top-right
// corner. The count goes in the link's accessible name; the visual bubble
// is aria-hidden so screen readers don't read the number twice. The ring
// is the nav's own background colour, so the bubble reads as sitting on
// top of the icon.
function MessagesIconLink({ count, onClick }: { count: number; onClick?: () => void }) {
  const label = count > 0 ? `Messages, ${count} unread` : 'Messages';
  return (
    <Link
      href="/messages"
      onClick={onClick}
      aria-label={label}
      title="Messages"
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-full text-ink hover:bg-paper-dim transition-colors"
    >
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.55L3 20.5l1.5-5.1A8.5 8.5 0 1 1 21 11.5z" />
      </svg>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[11px] font-bold leading-none ring-2 ring-paper"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-ink text-paper text-[10.5px] font-semibold align-middle"
      aria-label={`${count} new notification${count === 1 ? '' : 's'}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function Nav() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const [mobileOpen, setMobileOpen] = useState(false);
  const canMessage = status === 'authenticated' && (role === 'developer' || role === 'contractor');
  const unread = useUnreadMessages(canMessage);
  const unreadMessages = (unread as { messages?: number }).messages ?? 0;
  // Everything except messages, which have their own badge on the icon.
  const unreadTotal = Math.max(0, unread.total - unreadMessages);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <nav className="sticky top-0 z-50 bg-paper/90 backdrop-blur-sm border-b border-line">
      <div className="max-w-[1440px] mx-auto px-5 sm:px-8 h-[var(--nav-h)] flex items-center justify-between">
        <Link href="/" aria-label="(kalm) home" className="text-[24px]" onClick={closeMobile}>
          <Wordmark />
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
              <UnreadBadge count={unreadTotal} />
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-6">
          {status === 'loading' ? null : status === 'authenticated' ? (
            <>
              {canMessage && <MessagesIconLink count={unreadMessages} />}
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
                Sign up as developer
              </Link>
            </>
          )}
        </div>

        {/* Messages icon + hamburger toggle, only rendered/visible below md; mirrors the
            `hidden md:flex` pattern used everywhere else in this file. */}
        <div className="md:hidden flex items-center gap-2">
          {canMessage && <MessagesIconLink count={unreadMessages} onClick={closeMobile} />}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="relative flex flex-col justify-center gap-1.5 w-8 h-8 -mr-1"
            aria-expanded={mobileOpen}
            aria-label={
              mobileOpen ? 'Close menu' : unreadTotal > 0 ? `Open menu (${unreadTotal} new notifications)` : 'Open menu'
            }
          >
            {!mobileOpen && unreadTotal > 0 && (
              <span className="absolute top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ink" aria-hidden="true" />
            )}
            <span
              className={`block h-[1.5px] bg-ink transition-transform ${mobileOpen ? 'translate-y-[6.5px] rotate-45' : ''}`}
            />
            <span className={`block h-[1.5px] bg-ink transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
            <span
              className={`block h-[1.5px] bg-ink transition-transform ${mobileOpen ? '-translate-y-[6.5px] -rotate-45' : ''}`}
            />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-line bg-paper px-5 sm:px-8 py-5 flex flex-col gap-5">
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
          {canMessage && (
            <Link href="/messages" className="text-sm text-ink" onClick={closeMobile}>
              Messages
              <UnreadBadge count={unreadMessages} />
            </Link>
          )}
          {status === 'authenticated' && (
            <Link
              href={role === 'contractor' ? '/contractor/dashboard' : '/dashboard'}
              className="text-sm text-ink"
              onClick={closeMobile}
            >
              Dashboard
              <UnreadBadge count={unreadTotal} />
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
                  Sign up as developer
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
